import path from "node:path";

import {
  clearSessionState,
  readSessionState,
  resolveSessionStatePath,
  type RuntimeSessionState,
} from "./session-state.js";

export type SessionInspection =
  | {
      state: "missing";
      cwd: string;
      sessionPath: string;
    }
  | {
      state: "stale";
      cwd: string;
      sessionPath: string;
      session: RuntimeSessionState;
      reason: "pid_missing" | "pid_not_alive";
    }
  | {
      state: "unreachable";
      cwd: string;
      sessionPath: string;
      session: RuntimeSessionState;
    }
  | {
      state: "wrong_project";
      cwd: string;
      sessionPath: string;
      session: RuntimeSessionState;
      expectedProjectRoot: string;
      actualProjectRoot: string;
    }
  | {
      state: "running";
      cwd: string;
      sessionPath: string;
      session: RuntimeSessionState;
    };

export type InspectSessionOptions = {
  cwd?: string;
  fetchImplementation?: typeof fetch;
};

export async function inspectSession(
  options: InspectSessionOptions = {},
): Promise<SessionInspection> {
  const cwd = path.resolve(options.cwd ?? process.cwd());
  const sessionPath = resolveSessionStatePath(cwd);
  let session: RuntimeSessionState;

  try {
    session = await readSessionState(cwd);
  } catch {
    return {
      state: "missing",
      cwd,
      sessionPath,
    };
  }

  const expectedProjectRoot = path.dirname(path.resolve(session.configPath));
  if (expectedProjectRoot !== cwd) {
    return {
      state: "wrong_project",
      cwd,
      sessionPath,
      session,
      expectedProjectRoot,
      actualProjectRoot: cwd,
    };
  }

  if (!Number.isInteger(session.pid) || session.pid <= 0) {
    return {
      state: "stale",
      cwd,
      sessionPath,
      session,
      reason: "pid_missing",
    };
  }

  if (!isProcessAlive(session.pid)) {
    return {
      state: "stale",
      cwd,
      sessionPath,
      session,
      reason: "pid_not_alive",
    };
  }

  const fetchImplementation = options.fetchImplementation ?? fetch;
  const healthUrl = new URL("/health", ensureTrailingSlash(session.url));

  try {
    const response = await fetchImplementation(healthUrl);
    if (!response.ok) {
      return {
        state: "unreachable",
        cwd,
        sessionPath,
        session,
      };
    }
  } catch {
    return {
      state: "unreachable",
      cwd,
      sessionPath,
      session,
    };
  }

  return {
    state: "running",
    cwd,
    sessionPath,
    session,
  };
}

export async function clearStaleSession(options: {
  cwd?: string;
  inspection?: SessionInspection;
} = {}): Promise<boolean> {
  const inspection = options.inspection ?? (await inspectSession({ cwd: options.cwd }));

  if (inspection.state === "running") {
    return false;
  }

  await clearSessionState(inspection.cwd);
  return true;
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return isPermissionError(error);
  }
}

function isPermissionError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "EPERM"
  );
}

function ensureTrailingSlash(url: string): string {
  return url.endsWith("/") ? url : `${url}/`;
}
