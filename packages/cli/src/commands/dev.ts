import { access } from "node:fs/promises";
import path from "node:path";

import { loadDevdeckConfig, DevdeckError } from "@devdeck/config";
import { ServiceSession, type ServiceDefinition, type SessionEvent } from "@devdeck/core";
import { createSessionServer } from "@devdeck/server";

import type { CommandIo } from "./init.js";
import { clearSessionState, writeSessionState } from "../session-state.js";

export type DevCommandOptions = {
  cwd?: string;
  io?: CommandIo;
  holdUntilSignal?: boolean;
  port?: number;
  onServerStarted?: () => Promise<void>;
};

export async function runDevCommand(options: DevCommandOptions = {}): Promise<void> {
  const io = options.io ?? defaultIo;
  const loaded = await loadDevdeckConfig(options.cwd);
  const services = Object.entries(loaded.config.services).map(([serviceName, service]) =>
    toServiceDefinition(serviceName, service, loaded.directory),
  );
  const session = new ServiceSession({
    project: loaded.config.project,
    services,
  });
  const dashboardAssetsDirectory = await resolveDashboardAssetsDirectory();
  const stopController = createStopController();
  const server = createSessionServer({
    dashboardAssetsDirectory,
    port: options.port,
    session,
    onStopSession: async () => {
      stopController.request("dashboard");
    },
  });
  
  let serverInfo;
  try {
    serverInfo = await server.start();
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes("EADDRINUSE")) {
      throw new DevdeckError(
        "DD-ERR-0010",
        `Port ${options.port ?? 4545} is already in use.`,
        "Specify a different port using '--port <number>', or stop the process currently running on that port."
      );
    }
    throw new DevdeckError(
      "DD-ERR-0015",
      `Failed to start session server: ${msg}`,
      "Ensure you have network permissions and the port is free."
    );
  }
  await writeSessionState({
    cwd: loaded.directory,
    session: {
      version: 1,
      project: loaded.config.project,
      configPath: loaded.path,
      url: serverInfo.url,
      port: serverInfo.port,
      pid: process.pid,
      startedAt: session.startedAt,
    },
  });
  await options.onServerStarted?.();

  session.subscribe((event) => handleSessionEvent(event, io));
  io.stdout(`Project: ${loaded.config.project}\n`);
  io.stdout(`Config: ${loaded.path}\n`);
  io.stdout(`Dashboard: ${serverInfo.url}\n`);
  io.stdout(`Starting ${services.length} service${services.length === 1 ? "" : "s"}\n`);

  for (const service of services) {
    const parts = [`- ${service.name}: ${service.command}`, `cwd=${service.cwd}`];

    if (service.port !== undefined) {
      parts.push(`port=${service.port}`);
    }

    io.stdout(`${parts.join(" | ")}\n`);
  }

  await session.startAll();

  if (options.holdUntilSignal === false) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    await session.stopAll();
    await server.stop();
    await clearSessionState(loaded.directory);
    return;
  }

  io.stdout("Press Ctrl+C to stop DevDeck.\n");
  await waitForStopRequest(io, stopController);
  await session.stopAll();
  await server.stop();
  await clearSessionState(loaded.directory);
}

const defaultIo: CommandIo = {
  stdout: (message) => process.stdout.write(message),
  stderr: (message) => process.stderr.write(message),
};

function toServiceDefinition(
  serviceName: string,
  service: { command: string; cwd: string; group?: string; port?: number },
  directory: string,
): ServiceDefinition {
  const definition = {
    name: serviceName,
    command: service.command,
    cwd: path.resolve(directory, service.cwd),
    port: service.port,
  } as ServiceDefinition;

  if (service.group !== undefined) {
    Object.assign(definition as ServiceDefinition & { group?: string }, {
      group: service.group,
    });
  }

  return definition;
}

function handleSessionEvent(event: SessionEvent, io: CommandIo): void {
  if (event.type === "log") {
    io.stdout(`[${event.log.service}:${event.log.stream}] ${event.log.line}\n`);
    return;
  }

  io.stdout(`[${event.service.name}] Status changed: ${event.service.status.toUpperCase()}\n`);
  if (event.service.status === "error" && event.service.lastError) {
    io.stderr(`[DD-ERR-0011] Service '${event.service.name}' failed to run: ${event.service.lastError}\n`);
    io.stderr(`Hint: Check config command syntax in devdeck.yml, verify dependencies are installed, or run 'devdeck logs ${event.service.name}' for full process output.\n`);
  }
  if (event.service.status === "exited" && event.service.lastExitCode !== null && event.service.lastExitCode !== 0) {
    io.stderr(`[DD-ERR-0011] Service '${event.service.name}' exited with non-zero code ${event.service.lastExitCode}\n`);
    io.stderr(`Hint: Run 'devdeck logs ${event.service.name}' to see why the process crashed.\n`);
  }
}

async function resolveDashboardAssetsDirectory(): Promise<string> {
  const prodDirectory = path.resolve(
    new URL("../dashboard", import.meta.url).pathname,
  );
  const devDirectory = path.resolve(
    new URL("../../../../apps/dashboard/out", import.meta.url).pathname,
  );

  try {
    await access(prodDirectory);
    return prodDirectory;
  } catch {
    try {
      await access(devDirectory);
      return devDirectory;
    } catch {
      const fallbackDirectory = path.resolve(
        new URL("../../../../apps/dashboard/static", import.meta.url).pathname,
      );
      return fallbackDirectory;
    }
  }
}

async function waitForStopRequest(
  io: CommandIo,
  stopController: ReturnType<typeof createStopController>,
): Promise<void> {
  await new Promise<void>((resolve) => {
    const shutdown = (source: string) => {
      process.off("SIGINT", onSigint);
      process.off("SIGTERM", onSigterm);
      io.stdout(`Stopping DevDeck (${source})...\n`);
      resolve();
    };

    const onSigint = () => {
      shutdown("SIGINT");
    };
    const onSigterm = () => {
      shutdown("SIGTERM");
    };

    process.on("SIGINT", onSigint);
    process.on("SIGTERM", onSigterm);
    stopController.onStop((source) => {
      shutdown(source);
    });
  });
}

function createStopController(): {
  onStop: (listener: (source: string) => void) => void;
  request: (source: string) => void;
} {
  const listeners = new Set<(source: string) => void>();

  return {
    onStop(listener) {
      listeners.add(listener);
    },
    request(source) {
      for (const listener of listeners) {
        listener(source);
      }
    },
  };
}
