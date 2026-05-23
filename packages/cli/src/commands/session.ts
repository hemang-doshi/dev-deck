import type { LogSeverity, SessionSnapshot } from "@devdeck/core";
import { getLogs, getSnapshot, postAction, type AgentClientOptions } from "../agent-client.js";
import { formatLogs, formatSnapshot, formatStatus } from "../format-agent-output.js";
import type { CommandIo } from "./init.js";

export type SessionCommandOptions = AgentClientOptions & {
  io?: CommandIo;
};

export async function runStatusCommand(
  args: string[],
  options: SessionCommandOptions = {},
): Promise<void> {
  const flags = parseCommonFlags(args);
  const snapshot = await getSnapshot({
    cwd: options.cwd,
    fetchImplementation: options.fetchImplementation,
    url: flags.url,
  });

  writeOutput(options.io, flags.json ? JSON.stringify(snapshot, null, 2) : formatStatus(snapshot));
}

export async function runLogsCommand(
  args: string[],
  options: SessionCommandOptions = {},
): Promise<void> {
  let service: string | undefined;
  let tail = 80;
  let severity: LogSeverity | undefined;
  let grep: string | undefined;
  let json = false;
  let url: string | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (!arg) {
      continue;
    }

    if (!arg.startsWith("--") && service === undefined) {
      service = arg;
      continue;
    }

    if (arg === "--tail") {
      tail = parsePositiveInteger(args[index + 1], "--tail");
      index += 1;
      continue;
    }

    if (arg === "--severity") {
      const value = args[index + 1];
      if (value !== "info" && value !== "warning" && value !== "error") {
        throw new Error("Invalid --severity value. Expected info, warning, or error.");
      }
      severity = value;
      index += 1;
      continue;
    }

    if (arg === "--grep") {
      grep = requireValue(args[index + 1], "--grep");
      index += 1;
      continue;
    }

    if (arg === "--json") {
      json = true;
      continue;
    }

    if (arg === "--url") {
      url = requireValue(args[index + 1], "--url");
      index += 1;
      continue;
    }

    throw new Error(`Unknown logs option: ${arg}`);
  }

  const result = await getLogs(
    {
      service,
      tail,
      severity,
      grep,
    },
    {
      cwd: options.cwd,
      fetchImplementation: options.fetchImplementation,
      url,
    },
  );

  writeOutput(options.io, json ? JSON.stringify(result, null, 2) : formatLogs(result));
}

export async function runSnapshotCommand(
  args: string[],
  options: SessionCommandOptions = {},
): Promise<void> {
  const flags = parseCommonFlags(args);
  const tail = parseOptionalTail(args);
  const snapshot = await getSnapshot({
    cwd: options.cwd,
    fetchImplementation: options.fetchImplementation,
    url: flags.url,
  });
  const limitedSnapshot: SessionSnapshot = {
    ...snapshot,
    logs: snapshot.logs.slice(-tail),
  };

  writeOutput(
    options.io,
    flags.json
      ? JSON.stringify(limitedSnapshot, null, 2)
      : formatSnapshot(snapshot, tail),
  );
}

export async function runStopCommand(
  args: string[],
  options: SessionCommandOptions = {},
): Promise<void> {
  const flags = parseCommonFlags(args);
  await postAction(
    { action: "stop-session" },
    {
      cwd: options.cwd,
      fetchImplementation: options.fetchImplementation,
      url: flags.url,
    },
  );
  writeOutput(options.io, "Requested stop-session\n");
}

export async function runServiceCommand(
  args: string[],
  options: SessionCommandOptions = {},
): Promise<void> {
  const action = args[0];
  const serviceName = args[1];
  const flags = parseCommonFlags(args.slice(2));

  if (action !== "start" && action !== "stop" && action !== "restart") {
    throw new Error("Usage: devdeck service <start|stop|restart> <name> [--url URL]");
  }

  if (!serviceName) {
    throw new Error("Usage: devdeck service <start|stop|restart> <name> [--url URL]");
  }

  await postAction(
    { action, serviceName },
    {
      cwd: options.cwd,
      fetchImplementation: options.fetchImplementation,
      url: flags.url,
    },
  );
  writeOutput(options.io, `Requested ${action} for ${serviceName}\n`);
}

function parseCommonFlags(args: string[]): { json: boolean; url?: string } {
  let json = false;
  let url: string | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--json") {
      json = true;
      continue;
    }

    if (arg === "--url") {
      url = requireValue(args[index + 1], "--url");
      index += 1;
      continue;
    }

    if (arg === "--tail") {
      index += 1;
      continue;
    }

    throw new Error(`Unknown option: ${arg}`);
  }

  return { json, url };
}

function parseOptionalTail(args: string[]): number {
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === "--tail") {
      return parsePositiveInteger(args[index + 1], "--tail");
    }
  }

  return 120;
}

function parsePositiveInteger(value: string | undefined, flagName: string): number {
  const parsed = Number.parseInt(requireValue(value, flagName), 10);

  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`Invalid ${flagName} value. Expected a positive integer.`);
  }

  return parsed;
}

function requireValue(value: string | undefined, flagName: string): string {
  if (!value) {
    throw new Error(`Missing value for ${flagName}.`);
  }

  return value;
}

function writeOutput(io: CommandIo | undefined, message: string): void {
  (io ?? defaultIo).stdout(message);
}

const defaultIo: CommandIo = {
  stdout: (message) => process.stdout.write(message),
  stderr: (message) => process.stderr.write(message),
};
