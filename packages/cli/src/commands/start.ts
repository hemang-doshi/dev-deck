import { spawn } from "node:child_process";
import { access, mkdir } from "node:fs/promises";
import { openSync } from "node:fs";
import path from "node:path";
import { DevdeckError, findDevdeckConfigPath } from "@devdeck/config";
import type { SessionSnapshot } from "@devdeck/core";
import { createDevDeckErrorPayload } from "../agent-errors.js";
import { createErrorResponse, createSuccessResponse, printJsonResponse } from "../agent-response.js";
import { getSnapshot } from "../agent-client.js";
import { resolveSessionStatePath } from "../session-state.js";
import { clearStaleSession, inspectSession } from "../session-inspector.js";
import type { CommandIo } from "./init.js";

export type StartCommandOptions = {
  cwd?: string;
  io?: CommandIo;
  port?: number;
  json?: boolean;
  waitSeconds?: number;
};

export async function runStartCommand(options: StartCommandOptions = {}): Promise<number> {
  const cwd = path.resolve(options.cwd ?? process.cwd());
  const io = options.io ?? defaultIo;
  const waitSeconds = options.waitSeconds ?? 10;

  // Resolve where devdeck.yml is located so we check/write state in the correct directory
  let configDir = cwd;
  try {
    const configPath = await findDevdeckConfigPath(cwd);
    if (configPath) {
      configDir = path.dirname(configPath);
    }
  } catch (error) {
    io.stderr(`[Warning] Failed to resolve config path: ${error instanceof Error ? error.message : String(error)}\n`);
  }

  // 1. Check if a session is already running or needs cleanup
  const existingSession = await inspectSession({ cwd: configDir }).catch(() => null);
  if (existingSession?.state === "running") {
    const state = existingSession.session;
    if (options.json) {
      printJsonResponse(
        createErrorResponse(
          {
            command: "start",
            project: state.project,
            summary: "DevDeck session is already running.",
          },
          createDevDeckErrorPayload({
            code: "DD_SESSION_RUNNING",
            message: `DevDeck is already running at PID ${state.pid}.`,
            hint: "Run devdeck stop --json to stop the current session first.",
            severity: "error",
            retryable: false,
            evidence: [
              {
                type: "session",
                path: resolveSessionStatePath(configDir),
                pid: state.pid,
                url: state.url,
              },
            ],
            nextActions: [
              {
                type: "command",
                command: "devdeck status --json",
                reason: "Inspect the active DevDeck session.",
              },
              {
                type: "command",
                command: "devdeck stop --json",
                reason: "Stop the current session before starting another.",
              },
            ],
          }),
        ),
        io.stdout,
      );
    } else {
      io.stderr(`[DD-ERR-0013] DevDeck is already running at PID ${state.pid} (Dashboard: ${state.url}).\n`);
      io.stderr("Hint: Run 'devdeck stop' to stop the current session first.\n");
    }
    return 1;
  }

  if (
    existingSession &&
    (existingSession.state === "stale" || existingSession.state === "unreachable")
  ) {
    await stopLingeringSessionProcess(existingSession);
    await clearStaleSession({ cwd: configDir, inspection: existingSession }).catch(() => {});
  }

  // 2. Ensure .devdeck directory exists in the configuration directory
  const devdeckDir = path.join(configDir, ".devdeck");
  await mkdir(devdeckDir, { recursive: true });

  const logFile = path.join(devdeckDir, "devdeck.log");
  const out = openSync(logFile, "a");
  const err = openSync(logFile, "a");

  if (!options.json) {
    io.stdout("Starting DevDeck in the background...\n");
  }

  // 3. Spawn the foreground dev command in detached mode
  const args = ["dev"];
  if (options.port !== undefined) {
    args.push("--port", String(options.port));
  }

  const child = spawn(process.execPath, [process.argv[1], ...args], {
    detached: true,
    stdio: ["ignore", out, err],
    cwd,
    env: { ...process.env },
  });

  child.unref();

  // 4. Poll for session.json to be written and the session API to become responsive
  const sessionPath = resolveSessionStatePath(configDir);
  const startDeadline = Date.now() + waitSeconds * 1000;
  let sessionState = null;

  while (Date.now() <= startDeadline) {
    await sleep(100);
    try {
      await access(sessionPath);
      const inspection = await inspectSession({ cwd: configDir });
      if (inspection.state === "running") {
        sessionState = inspection.session;
        break;
      }
    } catch {
      // Not ready yet
    }
  }

  if (!sessionState) {
    const message = `DevDeck background process started but failed to become reachable within ${waitSeconds} second${waitSeconds === 1 ? "" : "s"}.`;

    if (options.json) {
      printJsonResponse(
        createErrorResponse(
          {
            command: "start",
            summary: message,
          },
          createDevDeckErrorPayload({
            code: "DD_SESSION_START_TIMEOUT",
            message,
            hint: `Check background logs at ${logFile} for details.`,
            severity: "error",
            retryable: true,
            evidence: [
              {
                type: "session",
                path: sessionPath,
              },
              {
                type: "log",
                service: "devdeck",
                lines: [logFile],
              },
            ],
            nextActions: [
              {
                type: "command",
                command: "devdeck session inspect --json",
                reason: "Inspect the saved DevDeck session state.",
              },
            ],
          }),
        ),
        io.stdout,
      );
      return 1;
    }

    throw new DevdeckError(
      "DD-ERR-0014",
      message,
      `Check background logs at ${logFile} for details.`
    );
  }

  if (waitSeconds > 0) {
    const readinessResult = await waitForActionableRuntimeState({
      cwd: configDir,
      deadline: startDeadline,
    });

    if (readinessResult.kind === "failure") {
      const failureSummary = summarizeStartupFailure(readinessResult.snapshot);
      if (options.json) {
        printJsonResponse(
          createErrorResponse(
            {
              command: "start",
              project: sessionState.project,
              summary: "DevDeck startup reached a degraded runtime state.",
            },
            createDevDeckErrorPayload({
              code: "DD_STARTUP_DEGRADED",
              message: failureSummary,
              hint: "Run devdeck status --agent or devdeck logs <service> for bounded failure evidence.",
              severity: "error",
              retryable: true,
              evidence: [
                {
                  type: "session",
                  path: sessionPath,
                  pid: sessionState.pid,
                  url: sessionState.url,
                },
              ],
              nextActions: [
                {
                  type: "command",
                  command: "devdeck status --agent",
                  reason: "Inspect the degraded service state.",
                },
              ],
            }),
          ),
          io.stdout,
        );
      } else {
        io.stderr(`[DD-ERR-0016] ${failureSummary}\n`);
        io.stderr("Hint: Run 'devdeck status --agent' or 'devdeck logs <service>' for bounded failure evidence.\n");
      }
      return 1;
    }

    if (readinessResult.kind === "timeout") {
      const message = `DevDeck session became reachable but the stack did not reach a healthy runtime state within ${waitSeconds} second${waitSeconds === 1 ? "" : "s"}.`;
      if (options.json) {
        printJsonResponse(
          createErrorResponse(
            {
              command: "start",
              project: sessionState.project,
              summary: message,
            },
            createDevDeckErrorPayload({
              code: "DD_STARTUP_WAIT_TIMEOUT",
              message,
              hint: "Run devdeck status --agent to inspect the partial runtime state.",
              severity: "error",
              retryable: true,
              evidence: [
                {
                  type: "session",
                  path: sessionPath,
                  pid: sessionState.pid,
                  url: sessionState.url,
                },
              ],
              nextActions: [
                {
                  type: "command",
                  command: "devdeck status --agent",
                  reason: "Inspect the partial runtime state.",
                },
              ],
            }),
          ),
          io.stdout,
        );
      } else {
        io.stderr(`[DD-ERR-0017] ${message}\n`);
        io.stderr("Hint: Run 'devdeck status --agent' to inspect the partial runtime state.\n");
      }
      return 1;
    }
  }

  if (options.json) {
    printJsonResponse(
      createSuccessResponse(
        {
          command: "start",
          project: sessionState.project,
          summary: "DevDeck started successfully in the background.",
        },
        {
          state: "running",
          pid: sessionState.pid,
          url: sessionState.url,
          logs: logFile,
        },
      ),
      io.stdout,
    );
  } else {
    io.stdout("DevDeck started successfully in the background!\n");
    io.stdout(`PID: ${sessionState.pid}\n`);
    io.stdout(`Dashboard: ${sessionState.url}\n`);
    io.stdout(`Logs: ${logFile}\n`);
  }
  return 0;
}

const defaultIo: CommandIo = {
  stdout: (message) => process.stdout.write(message),
  stderr: (message) => process.stderr.write(message),
};

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function stopLingeringSessionProcess(
  inspection: Awaited<ReturnType<typeof inspectSession>>,
): Promise<void> {
  if (!("session" in inspection)) {
    return;
  }

  const pid = inspection.session.pid;
  if (!Number.isInteger(pid) || pid <= 0) {
    return;
  }

  try {
    process.kill(pid, "SIGTERM");
  } catch {
    return;
  }

  const deadline = Date.now() + 3_000;
  while (Date.now() <= deadline) {
    try {
      process.kill(pid, 0);
      await sleep(100);
    } catch {
      return;
    }
  }

  try {
    process.kill(pid, "SIGKILL");
  } catch {
    // Process already exited.
  }
}

async function waitForActionableRuntimeState(options: {
  cwd: string;
  deadline: number;
}): Promise<
  | { kind: "healthy"; snapshot: SessionSnapshot }
  | { kind: "failure"; snapshot: SessionSnapshot }
  | { kind: "timeout"; snapshot: SessionSnapshot | null }
> {
  let latestSnapshot: SessionSnapshot | null = null;

  while (Date.now() <= options.deadline) {
    try {
      const snapshot = await getSnapshot({ cwd: options.cwd });
      latestSnapshot = snapshot;

      if (hasStartupFailure(snapshot)) {
        return { kind: "failure", snapshot };
      }

      if (isHealthyStartupSnapshot(snapshot)) {
        return { kind: "healthy", snapshot };
      }
    } catch {
      // Session can still be settling.
    }

    await sleep(150);
  }

  return { kind: "timeout", snapshot: latestSnapshot };
}

function isHealthyStartupSnapshot(snapshot: SessionSnapshot): boolean {
  return snapshot.services.length > 0 && snapshot.services.every((service) => {
    if (service.status !== "running") {
      return false;
    }

    if (service.readinessProbe && service.readiness !== "ready") {
      return false;
    }

    if (service.healthProbe && service.health !== "healthy") {
      return false;
    }

    return true;
  });
}

function hasStartupFailure(snapshot: SessionSnapshot): boolean {
  return snapshot.services.some((service) => {
    if (service.status === "error" || service.status === "exited" || service.status === "blocked") {
      return true;
    }

    return service.readiness === "failed";
  });
}

function summarizeStartupFailure(snapshot: SessionSnapshot): string {
  const failingServices = snapshot.services.filter((service) => {
    return (
      service.status === "error" ||
      service.status === "exited" ||
      service.status === "blocked" ||
      service.readiness === "failed"
    );
  });

  if (failingServices.length === 0) {
    return "DevDeck startup reached a degraded runtime state.";
  }

  return failingServices
    .slice(0, 3)
    .map((service) => `${service.name}: ${service.lastError ?? `status=${service.status} readiness=${service.readiness}`}`)
    .join("; ");
}
