#!/usr/bin/env node

import { ConfigError } from "@devdeck/config";

import { runAgentCommand } from "./commands/agent.js";
import { runDevCommand } from "./commands/dev.js";
import { runInitCommand } from "./commands/init.js";
import {
  runLogsCommand,
  runServiceCommand,
  runSnapshotCommand,
  runStatusCommand,
  runStopCommand,
} from "./commands/session.js";
import type { CommandIo } from "./commands/init.js";

type CommandName = "init" | "dev" | "agent" | "status" | "logs" | "snapshot" | "stop" | "service";

export type RunCliOptions = {
  cwd?: string;
  io?: CommandIo;
  fetchImplementation?: typeof fetch;
};

export async function runCli(argv: string[], options: RunCliOptions = {}): Promise<number> {
  const command = argv[0] as CommandName | undefined;
  const io = options.io ?? defaultIo;

  if (!command) {
    io.stderr("Usage: devdeck <init|dev|agent|status|logs|snapshot|stop|service>\n");
    return 1;
  }

  try {
    if (command === "init") {
      await runInitCommand({
        cwd: options.cwd,
        io,
      });
      return 0;
    }

    if (command === "dev") {
      const parsed = parseDevArgs(argv.slice(1));
      await runDevCommand({
        cwd: options.cwd,
        io,
        port: parsed.port,
      });
      return 0;
    }

    if (command === "agent") {
      await runAgentCommand(argv.slice(1), io);
      return 0;
    }

    if (command === "status") {
      await runStatusCommand(argv.slice(1), {
        cwd: options.cwd,
        io,
        fetchImplementation: options.fetchImplementation,
      });
      return 0;
    }

    if (command === "logs") {
      await runLogsCommand(argv.slice(1), {
        cwd: options.cwd,
        io,
        fetchImplementation: options.fetchImplementation,
      });
      return 0;
    }

    if (command === "snapshot") {
      await runSnapshotCommand(argv.slice(1), {
        cwd: options.cwd,
        io,
        fetchImplementation: options.fetchImplementation,
      });
      return 0;
    }

    if (command === "stop") {
      await runStopCommand(argv.slice(1), {
        cwd: options.cwd,
        io,
        fetchImplementation: options.fetchImplementation,
      });
      return 0;
    }

    if (command === "service") {
      await runServiceCommand(argv.slice(1), {
        cwd: options.cwd,
        io,
        fetchImplementation: options.fetchImplementation,
      });
      return 0;
    }

    io.stderr(`Unknown command: ${command}\n`);
    io.stderr("Usage: devdeck <init|dev|agent|status|logs|snapshot|stop|service>\n");
    return 1;
  } catch (error) {
    if (error instanceof ConfigError || error instanceof Error) {
      io.stderr(`${error.message}\n`);
      return 1;
    }

    io.stderr("Unexpected error\n");
    return 1;
  }
}

function parseDevArgs(args: string[]): { port?: number } {
  let port: number | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--port") {
      const raw = args[index + 1];
      if (!raw) {
        throw new Error("Missing value for --port.");
      }

      const parsed = Number.parseInt(raw, 10);
      if (!Number.isInteger(parsed) || parsed < 1) {
        throw new Error("Invalid --port value. Expected a positive integer.");
      }

      port = parsed;
      index += 1;
      continue;
    }

    throw new Error(`Unknown dev option: ${arg}`);
  }

  return { port };
}

const defaultIo: CommandIo = {
  stdout: (message) => process.stdout.write(message),
  stderr: (message) => process.stderr.write(message),
};

if (import.meta.url === `file://${process.argv[1]}`) {
  const exitCode = await runCli(process.argv.slice(2));
  process.exit(exitCode);
}
