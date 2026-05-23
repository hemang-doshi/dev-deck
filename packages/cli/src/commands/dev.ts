import { access } from "node:fs/promises";
import path from "node:path";

import { loadDevdeckConfig } from "@devdeck/config";
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
  const serverInfo = await server.start();
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

  io.stdout(`[${event.service.name}] ${event.service.status}\n`);
}

async function resolveDashboardAssetsDirectory(): Promise<string> {
  const exportDirectory = path.resolve(
    new URL("../../../../apps/dashboard/out", import.meta.url).pathname,
  );
  const fallbackDirectory = path.resolve(
    new URL("../../../../apps/dashboard/static", import.meta.url).pathname,
  );

  try {
    await access(exportDirectory);
    return exportDirectory;
  } catch {
    return fallbackDirectory;
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
