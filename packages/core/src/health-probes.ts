import { spawn } from "node:child_process";
import net from "node:net";

import type { HealthProbe, ServiceDefinition } from "./process-runner.js";

export type HealthProbeResult = "healthy" | "unreachable" | "degraded";

const DEFAULT_TIMEOUT_MS = 1_000;

export async function runHealthProbe(
  service: ServiceDefinition,
  probe: HealthProbe,
): Promise<HealthProbeResult> {
  if (probe.type === "tcp") {
    return (await checkTcp(probe.host ?? "127.0.0.1", probe.port, probe.timeoutMs))
      ? "healthy"
      : "unreachable";
  }

  if (probe.type === "http") {
    return (await checkHttp(probe.url, probe.expectedStatus ?? 200, probe.timeoutMs))
      ? "healthy"
      : "unreachable";
  }

  return (await checkCommand(service, probe.command, probe.timeoutMs))
    ? "healthy"
    : "degraded";
}

export function checkTcp(
  host: string,
  port: number,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port });
    const timeout = setTimeout(() => {
      socket.destroy();
      resolve(false);
    }, timeoutMs);

    socket.once("connect", () => {
      clearTimeout(timeout);
      socket.end();
      resolve(true);
    });

    socket.once("error", () => {
      clearTimeout(timeout);
      resolve(false);
    });
  });
}

async function checkHttp(
  url: string,
  expectedStatus: number,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { signal: controller.signal });
    return response.status === expectedStatus;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

function checkCommand(
  service: ServiceDefinition,
  command: string,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn(command, {
      cwd: service.cwd,
      shell: true,
      env: { ...process.env, ...service.env },
      stdio: "ignore",
    });
    const timeout = setTimeout(() => {
      killProcessTree(child.pid);
      resolve(false);
    }, timeoutMs);

    child.once("exit", (code) => {
      clearTimeout(timeout);
      resolve(code === 0);
    });

    child.once("error", () => {
      clearTimeout(timeout);
      resolve(false);
    });
  });
}

function killProcessTree(pid: number | undefined): void {
  if (pid === undefined) {
    return;
  }

  if (process.platform !== "win32") {
    try {
      process.kill(pid, "SIGKILL");
    } catch {
      // Process already exited.
    }
    return;
  }

  const killer = spawn("taskkill", ["/pid", String(pid), "/T", "/F"], {
    stdio: "ignore",
  });
  killer.on("error", () => {
    try {
      process.kill(pid, "SIGKILL");
    } catch {
      // Process already exited.
    }
  });
}
