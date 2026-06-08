#!/usr/bin/env node

import { DevdeckError } from "@devdeck/config";

import { runAgentCommand } from "./commands/agent.js";
import { runDevCommand } from "./commands/dev.js";
import { runStartCommand } from "./commands/start.js";
import { runInitCommand } from "./commands/init.js";
import {
  runLogsCommand,
  runSessionCommand,
  runServiceCommand,
  runSnapshotCommand,
  runStatusCommand,
  runStopCommand,
} from "./commands/session.js";
import type { CommandIo } from "./commands/init.js";

import { createErrorResponse, printJsonResponse } from "./agent-response.js";
import { createDevDeckErrorPayload } from "./agent-errors.js";
import { CliUsageError } from "./cli-errors.js";

type CommandName =
  | "init"
  | "dev"
  | "start"
  | "agent"
  | "status"
  | "logs"
  | "snapshot"
  | "stop"
  | "service"
  | "session";

export type RunCliOptions = {
  cwd?: string;
  io?: CommandIo;
  fetchImplementation?: typeof fetch;
};

export async function runCli(argv: string[], options: RunCliOptions = {}): Promise<number> {
  const command = argv[0] as CommandName | undefined;
  const io = options.io ?? defaultIo;

  if (!command) {
    io.stderr("Usage: devdeck <init|dev|start|agent|status|logs|snapshot|stop|service|session>\n");
    return 1;
  }

  const jsonMode = argv.includes("--json");

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

    if (command === "start") {
      const parsed = parseStartArgs(argv.slice(1));
      return await runStartCommand({
        cwd: options.cwd,
        io,
        port: parsed.port,
        json: parsed.json,
        waitSeconds: parsed.waitSeconds,
      });
    }

    if (command === "agent") {
      await runAgentCommand(argv.slice(1), io);
      return 0;
    }

    if (command === "status") {
      return (await runStatusCommand(argv.slice(1), {
        cwd: options.cwd,
        io,
        fetchImplementation: options.fetchImplementation,
      }))
        ? 0
        : 4;
    }

    if (command === "logs") {
      return (await runLogsCommand(argv.slice(1), {
        cwd: options.cwd,
        io,
        fetchImplementation: options.fetchImplementation,
      }))
        ? 0
        : 1;
    }

    if (command === "snapshot") {
      return (await runSnapshotCommand(argv.slice(1), {
        cwd: options.cwd,
        io,
        fetchImplementation: options.fetchImplementation,
      }))
        ? 0
        : 4;
    }

    if (command === "stop") {
      return (await runStopCommand(argv.slice(1), {
        cwd: options.cwd,
        io,
        fetchImplementation: options.fetchImplementation,
      }))
        ? 0
        : 4;
    }

    if (command === "service") {
      return (await runServiceCommand(argv.slice(1), {
        cwd: options.cwd,
        io,
        fetchImplementation: options.fetchImplementation,
      }))
        ? 0
        : 1;
    }

    if (command === "session") {
      return (await runSessionCommand(argv.slice(1), {
        cwd: options.cwd,
        io,
        fetchImplementation: options.fetchImplementation,
      }))
        ? 0
        : 4;
    }

    throw new CliUsageError(
      `Unknown command: ${command}`,
      "Usage: devdeck <init|dev|start|agent|status|logs|snapshot|stop|service|session>",
    );
  } catch (error) {
    if (jsonMode) {
      if (error instanceof CliUsageError) {
        printJsonResponse(
          createErrorResponse(
            {
              command: command ?? "unknown",
              summary: error.message,
            },
            createDevDeckErrorPayload({
              code: "DD_CLI_USAGE_INVALID",
              message: error.message,
              hint: error.hint,
              severity: "error",
              retryable: false,
              evidence: [],
              nextActions: [],
            }),
          ),
          io.stdout,
        );
        return 2;
      }

      printJsonResponse(
        createErrorResponse(
          {
            command: command ?? "unknown",
            summary: error instanceof DevdeckError ? error.message : "DevDeck command failed.",
          },
          createDevDeckErrorPayload({
            code: error instanceof DevdeckError ? normalizeDevdeckErrorCode(error.code) : "DD_INTERNAL_UNEXPECTED",
            message: error instanceof Error ? error.message : "Unexpected error",
            hint: error instanceof DevdeckError ? error.hint : undefined,
            severity: "error",
            retryable: false,
            evidence: [],
            nextActions: [],
          }),
        ),
        io.stdout,
      );
      return error instanceof DevdeckError ? 1 : 10;
    }

    if (error instanceof DevdeckError) {
      io.stderr(`[${error.code}] ${error.message}\n`);
      if (error.hint) {
        io.stderr(`Hint: ${error.hint}\n`);
      }
      return 1;
    }

    if (error instanceof CliUsageError) {
      io.stderr(`Usage error: ${error.message}\n`);
      if (error.hint) {
        io.stderr(`Hint: ${error.hint}\n`);
      }
      return 2;
    }

    if (error instanceof Error) {
      io.stderr(`[DD-ERR-9999] Unexpected error: ${error.message}\n`);
      return 1;
    }

    io.stderr("[DD-ERR-9999] Unexpected error\n");
    return 1;
  }
}

function parseDevArgs(args: string[]): { port?: number; json: boolean } {
  let port: number | undefined;
  let json = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--port") {
      port = parsePortValue(args[index + 1]);
      index += 1;
      continue;
    }

    if (arg === "--json") {
      json = true;
      continue;
    }

    throw new CliUsageError(`Unknown option: ${arg}`);
  }

  return { port, json };
}

function parseStartArgs(args: string[]): { port?: number; json: boolean; waitSeconds: number } {
  let port: number | undefined;
  let json = false;
  let waitSeconds = 10;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--port") {
      port = parsePortValue(args[index + 1]);
      index += 1;
      continue;
    }

    if (arg === "--wait") {
      waitSeconds = parseWaitValue(args[index + 1]);
      index += 1;
      continue;
    }

    if (arg === "--json") {
      json = true;
      continue;
    }

    throw new CliUsageError(`Unknown option: ${arg}`);
  }

  return { port, json, waitSeconds };
}

function parsePortValue(raw: string | undefined): number {
  if (!raw) {
    throw new CliUsageError("Missing value for --port.");
  }

  const parsed = Number.parseInt(raw, 10);
  if (!/^\d+$/.test(raw) || !Number.isInteger(parsed) || parsed < 1) {
    throw new CliUsageError("Invalid --port value. Expected a positive integer.");
  }

  return parsed;
}

function parseWaitValue(raw: string | undefined): number {
  if (!raw) {
    throw new CliUsageError("Missing value for --wait.");
  }

  const parsed = Number.parseInt(raw, 10);
  if (!/^\d+$/.test(raw) || !Number.isInteger(parsed) || parsed < 0 || parsed > 300) {
    throw new CliUsageError("Invalid --wait value. Expected an integer from 0 to 300 seconds.");
  }

  return parsed;
}

function normalizeDevdeckErrorCode(code: string): string {
  if (code === "DD-ERR-0012") {
    return "DD_SESSION_API_UNREACHABLE";
  }

  if (code === "DD-ERR-0014") {
    return "DD_PROCESS_ACTION_FAILED";
  }

  return code.startsWith("DD_") ? code : "DD_INTERNAL_UNEXPECTED";
}

const defaultIo: CommandIo = {
  stdout: (message) => process.stdout.write(message),
  stderr: (message) => process.stderr.write(message),
};

if (import.meta.url === `file://${process.argv[1]}`) {
  const exitCode = await runCli(process.argv.slice(2));
  process.exit(exitCode);
}
