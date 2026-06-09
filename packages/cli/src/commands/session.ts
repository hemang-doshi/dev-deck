import type { DevDeckEventType, LogSeverity, LogStream, SessionSnapshot, SeverityText } from "@devdeck/core";
import { DevdeckError } from "@devdeck/config";
import { getEvents, getLogs, getSnapshot, postAction, streamEvents, type AgentClientOptions } from "../agent-client.js";
import { createDevDeckErrorPayload, type DevDeckErrorPayload } from "../agent-errors.js";
import { createErrorResponse, createSuccessResponse, printJsonResponse } from "../agent-response.js";
import { CliUsageError } from "../cli-errors.js";
import { formatLogs, formatSnapshot, formatStatus } from "../format-agent-output.js";
import { clearStaleSession, inspectSession, type SessionInspection } from "../session-inspector.js";
import type { CommandIo } from "./init.js";

export type SessionCommandOptions = AgentClientOptions & {
  io?: CommandIo;
};

export async function runStatusCommand(
  args: string[],
  options: SessionCommandOptions = {},
): Promise<boolean> {
  const flags = parseCommonFlags(args);

  try {
    const snapshot = await getSnapshot({
      cwd: options.cwd,
      fetchImplementation: options.fetchImplementation,
      url: flags.url,
    });

    if (flags.json) {
      printJsonResponse(
        createSuccessResponse(
          {
            command: "status",
            project: snapshot.project,
            summary: `DevDeck session is running with ${snapshot.services.length} service${snapshot.services.length === 1 ? "" : "s"}.`,
          },
          {
            state: "running",
            services: snapshot.services,
            startedAt: snapshot.startedAt,
          },
        ),
        getWriter(options.io),
      );
    } else {
      writeOutput(options.io, formatStatus(snapshot));
    }

    return true;
  } catch (error) {
    if (!flags.json) {
      throw error;
    }

    printJsonResponse(
      createErrorResponse(
        {
          command: "status",
          summary: "No reachable DevDeck session was found.",
        },
        toAgentErrorPayload(error, "status"),
      ),
      getWriter(options.io),
    );
    return false;
  }
}

export async function runLogsCommand(
  args: string[],
  options: SessionCommandOptions = {},
): Promise<boolean> {
  let service: string | undefined;
  let tail = 80;
  let severity: LogSeverity | undefined;
  let logStream: LogStream | undefined;
  let grep: string | undefined;
  let errors = false;
  let context: number | undefined;
  let since: string | undefined;
  let stream = false;
  let jsonl = false;
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
        throw new CliUsageError("Invalid --severity value. Expected info, warning, or error.");
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

    if (arg === "--stream") {
      const value = args[index + 1];
      if (value === "stdout" || value === "stderr") {
        logStream = parseLogStream(value);
        index += 1;
      } else {
        stream = true;
      }
      continue;
    }

    if (arg === "--errors") {
      errors = true;
      continue;
    }

    if (arg === "--context") {
      context = parseNonNegativeInteger(args[index + 1], "--context");
      index += 1;
      continue;
    }

    if (arg === "--since") {
      since = requireValue(args[index + 1], "--since");
      index += 1;
      continue;
    }

    if (arg === "--json") {
      json = true;
      continue;
    }

    if (arg === "--jsonl") {
      jsonl = true;
      continue;
    }

    if (arg === "--url") {
      url = requireValue(args[index + 1], "--url");
      index += 1;
      continue;
    }

    throw new CliUsageError(`Unknown option: ${arg}`);
  }

  try {
    if (stream) {
      if (!jsonl) {
        throw new CliUsageError("Usage: devdeck logs [service] --stream --jsonl [--url URL]");
      }

      await streamEvents(
        (event) => {
          if (
            event.type === "service.log" &&
            (!service || event.service === service) &&
            (!logStream || event.stream === logStream) &&
            (!severity || event.severityText?.toLowerCase() === severity) &&
            (!grep || event.body?.toLowerCase().includes(grep.toLowerCase()))
          ) {
            writeOutput(options.io, `${JSON.stringify(event)}\n`);
          }
        },
        {
          cwd: options.cwd,
          url,
        },
      );
      return true;
    }

    const result = await getLogs(
      {
        service,
        tail,
        severity,
        stream: logStream,
        grep,
        errors,
        context,
        since,
      },
      {
        cwd: options.cwd,
        fetchImplementation: options.fetchImplementation,
        url,
      },
    );

    if (json) {
      printJsonResponse(
        createSuccessResponse(
          {
            command: "logs",
            project: result.project,
            summary: `Returned ${result.returned} of ${result.totalMatched} matching log line${result.totalMatched === 1 ? "" : "s"}.`,
          },
          result,
        ),
        getWriter(options.io),
      );
    } else {
      writeOutput(options.io, formatLogs(result));
    }

    return true;
  } catch (error) {
    if (!json) {
      throw error;
    }

    printJsonResponse(
      createErrorResponse(
        {
          command: "logs",
          summary: "Unable to query DevDeck logs.",
        },
        toAgentErrorPayload(error, "logs"),
      ),
      getWriter(options.io),
    );
    return false;
  }
}

export async function runEventsCommand(
  args: string[],
  options: SessionCommandOptions = {},
): Promise<boolean> {
  let service: string | undefined;
  let tail = 100;
  let type: DevDeckEventType | undefined;
  let severity: SeverityText | undefined;
  let since: string | undefined;
  let grep: string | undefined;
  let stream = false;
  let jsonl = false;
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

    if (arg === "--type") {
      type = requireValue(args[index + 1], "--type") as DevDeckEventType;
      index += 1;
      continue;
    }

    if (arg === "--severity") {
      severity = parseEventSeverity(requireValue(args[index + 1], "--severity"));
      index += 1;
      continue;
    }

    if (arg === "--since") {
      since = requireValue(args[index + 1], "--since");
      index += 1;
      continue;
    }

    if (arg === "--grep") {
      grep = requireValue(args[index + 1], "--grep");
      index += 1;
      continue;
    }

    if (arg === "--jsonl") {
      jsonl = true;
      continue;
    }

    if (arg === "--stream") {
      stream = true;
      continue;
    }

    if (arg === "--url") {
      url = requireValue(args[index + 1], "--url");
      index += 1;
      continue;
    }

    throw new CliUsageError(`Unknown option: ${arg}`);
  }

  if (!jsonl) {
    throw new CliUsageError("Usage: devdeck events [service] --jsonl [--stream] [--tail N] [--url URL]");
  }

  if (stream) {
    if (since) {
      throw new CliUsageError("devdeck events --stream does not support --since; use bounded devdeck events --jsonl --since first.");
    }

    await streamEvents(
      (event) => {
        if (
          (!service || event.service === service) &&
          (!type || event.type === type) &&
          (!severity || event.severityText === severity) &&
          (!grep || event.body?.toLowerCase().includes(grep.toLowerCase()))
        ) {
          writeOutput(options.io, `${JSON.stringify(event)}\n`);
        }
      },
      {
        cwd: options.cwd,
        url,
      },
    );
    return true;
  }

  const result = await getEvents(
    {
      service,
      tail,
      type,
      severity,
      since,
      grep,
    },
    {
      cwd: options.cwd,
      fetchImplementation: options.fetchImplementation,
      url,
    },
  );

  for (const event of result.events) {
    writeOutput(options.io, `${JSON.stringify(event)}\n`);
  }

  return true;
}

export async function runSnapshotCommand(
  args: string[],
  options: SessionCommandOptions = {},
): Promise<boolean> {
  const flags = parseCommonFlags(args);
  const tail = parseOptionalTail(args);
  try {
    const snapshot = await getSnapshot({
      cwd: options.cwd,
      fetchImplementation: options.fetchImplementation,
      url: flags.url,
    });
    const limitedSnapshot: SessionSnapshot = {
      ...snapshot,
      logs: snapshot.logs.slice(-tail),
    };

    if (flags.json) {
      printJsonResponse(
        createSuccessResponse(
          {
            command: "snapshot",
            project: snapshot.project,
            summary: `Captured DevDeck snapshot with ${snapshot.services.length} service${snapshot.services.length === 1 ? "" : "s"} and ${limitedSnapshot.logs.length} log line${limitedSnapshot.logs.length === 1 ? "" : "s"}.`,
          },
          limitedSnapshot,
        ),
        getWriter(options.io),
      );
    } else {
      writeOutput(options.io, formatSnapshot(snapshot, tail));
    }

    return true;
  } catch (error) {
    if (!flags.json) {
      throw error;
    }

    printJsonResponse(
      createErrorResponse(
        {
          command: "snapshot",
          summary: "Unable to capture DevDeck snapshot.",
        },
        toAgentErrorPayload(error, "snapshot"),
      ),
      getWriter(options.io),
    );
    return false;
  }
}

export async function runStopCommand(
  args: string[],
  options: SessionCommandOptions = {},
): Promise<boolean> {
  const flags = parseCommonFlags(args);
  try {
    await postAction(
      { action: "stop-session" },
      {
        cwd: options.cwd,
        fetchImplementation: options.fetchImplementation,
        url: flags.url,
      },
    );
    if (flags.json) {
      printJsonResponse(
        createSuccessResponse(
          {
            command: "stop",
            summary: "Requested DevDeck session stop.",
          },
          { requested: true },
        ),
        getWriter(options.io),
      );
    } else {
      writeOutput(options.io, "Requested stop-session\n");
    }
    return true;
  } catch (error) {
    if (error instanceof DevdeckError && error.code === "DD-ERR-0012") {
      if (flags.json) {
        printJsonResponse(
          createSuccessResponse(
            {
              command: "stop",
              summary: "DevDeck session is already stopped.",
            },
            { requested: false, state: "not_running" },
          ),
          getWriter(options.io),
        );
      } else {
        writeOutput(options.io, "DevDeck session is already stopped.\n");
      }
      return true;
    }
    if (flags.json) {
      printJsonResponse(
        createErrorResponse(
          {
            command: "stop",
            summary: "Unable to stop DevDeck session.",
          },
          toAgentErrorPayload(error, "stop"),
        ),
        getWriter(options.io),
      );
      return false;
    }
    throw error;
  }
}

export async function runServiceCommand(
  args: string[],
  options: SessionCommandOptions = {},
): Promise<boolean> {
  const action = args[0];
  const serviceName = args[1];
  const flags = parseCommonFlags(args.slice(2));

  if (action !== "start" && action !== "stop" && action !== "restart") {
    throw new CliUsageError("Usage: devdeck service <start|stop|restart> <name> [--url URL]");
  }

  if (!serviceName) {
    throw new CliUsageError("Usage: devdeck service <start|stop|restart> <name> [--url URL]");
  }

  try {
    await postAction(
      { action, serviceName },
      {
        cwd: options.cwd,
        fetchImplementation: options.fetchImplementation,
        url: flags.url,
      },
    );

    if (flags.json) {
      printJsonResponse(
        createSuccessResponse(
          {
            command: `service.${action}`,
            summary: `Requested ${action} for ${serviceName}.`,
          },
          { action, serviceName, requested: true },
        ),
        getWriter(options.io),
      );
    } else {
      writeOutput(options.io, `Requested ${action} for ${serviceName}\n`);
    }
    return true;
  } catch (error) {
    if (!flags.json) {
      throw error;
    }

    printJsonResponse(
      createErrorResponse(
        {
          command: `service.${action}`,
          summary: `Unable to ${action} ${serviceName}.`,
        },
        toAgentErrorPayload(error, `service.${action}`),
      ),
      getWriter(options.io),
    );
    return false;
  }
}

export async function runSessionCommand(
  args: string[],
  options: SessionCommandOptions = {},
): Promise<boolean> {
  const subcommand = args[0];
  const flags = parseCommonFlags(args.slice(1));

  if (subcommand === "inspect") {
    const inspection = await inspectSession({
      cwd: options.cwd,
      fetchImplementation: options.fetchImplementation,
    });

    if (!flags.json) {
      writeOutput(options.io, formatSessionInspection(inspection));
      return inspection.state === "running";
    }

    const result = sessionInspectionResult(inspection);
    if (inspection.state === "running") {
      printJsonResponse(
        createSuccessResponse(
          {
            command: "session.inspect",
            project: inspection.session.project,
            summary: "DevDeck session is running.",
          },
          result,
        ),
        getWriter(options.io),
      );
      return true;
    }

    printJsonResponse(
      createErrorResponse(
        {
          command: "session.inspect",
          project: "session" in inspection ? inspection.session.project : null,
          summary: sessionInspectionSummary(inspection),
        },
        errorForInspection(inspection),
      ),
      getWriter(options.io),
    );
    return false;
  }

  if (subcommand === "clear-stale") {
    const inspection = await inspectSession({
      cwd: options.cwd,
      fetchImplementation: options.fetchImplementation,
    });

    if (inspection.state === "running") {
      const error = createDevDeckErrorPayload({
        code: "DD_SESSION_RUNNING",
        message: "Refusing to clear an active DevDeck session.",
        severity: "error",
        retryable: false,
        evidence: [{ type: "session", path: inspection.sessionPath, pid: inspection.session.pid, url: inspection.session.url }],
        nextActions: [
          {
            type: "command",
            command: "devdeck stop --json",
            reason: "Stop the active session before clearing state.",
          },
        ],
      });

      if (flags.json) {
        printJsonResponse(
          createErrorResponse(
            {
              command: "session.clear-stale",
              project: inspection.session.project,
              summary: "Refusing to clear an active DevDeck session.",
            },
            error,
          ),
          getWriter(options.io),
        );
      } else {
        writeOutput(options.io, "Refusing to clear an active DevDeck session.\n");
      }
      return false;
    }

    const cleared = await clearStaleSession({ cwd: options.cwd, inspection });
    if (flags.json) {
      printJsonResponse(
        createSuccessResponse(
          {
            command: "session.clear-stale",
            project: "session" in inspection ? inspection.session.project : null,
            summary: cleared
              ? "Cleared stale DevDeck session state."
              : "No stale DevDeck session state was present.",
          },
          { cleared },
        ),
        getWriter(options.io),
      );
    } else {
      writeOutput(
        options.io,
        cleared
          ? "Cleared stale DevDeck session state.\n"
          : "No stale DevDeck session state was present.\n",
      );
    }
    return true;
  }

  throw new CliUsageError("Usage: devdeck session <inspect|clear-stale> [--json]");
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

    throw new CliUsageError(`Unknown option: ${arg}`);
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
  const raw = requireValue(value, flagName);
  const parsed = Number.parseInt(raw, 10);

  if (!/^\d+$/.test(raw) || !Number.isInteger(parsed) || parsed < 1) {
    throw new CliUsageError(`Invalid ${flagName} value. Expected a positive integer.`);
  }

  return parsed;
}

function parseNonNegativeInteger(value: string | undefined, flagName: string): number {
  const raw = requireValue(value, flagName);
  const parsed = Number.parseInt(raw, 10);

  if (!/^\d+$/.test(raw) || !Number.isInteger(parsed) || parsed < 0) {
    throw new CliUsageError(`Invalid ${flagName} value. Expected a non-negative integer.`);
  }

  return parsed;
}

function parseLogStream(value: string): LogStream {
  if (value === "stdout" || value === "stderr") {
    return value;
  }

  throw new CliUsageError("Invalid --stream value. Expected stdout or stderr.");
}

function parseEventSeverity(value: string): SeverityText {
  const upper = value.toUpperCase();
  if (upper === "TRACE" || upper === "DEBUG" || upper === "INFO" || upper === "WARN" || upper === "ERROR" || upper === "FATAL") {
    return upper;
  }

  throw new CliUsageError("Invalid --severity value. Expected trace, debug, info, warn, error, or fatal.");
}

function requireValue(value: string | undefined, flagName: string): string {
  if (!value) {
    throw new CliUsageError(`Missing value for ${flagName}.`);
  }

  return value;
}

function writeOutput(io: CommandIo | undefined, message: string): void {
  (io ?? defaultIo).stdout(message);
}

function getWriter(io: CommandIo | undefined): (message: string) => void {
  return (message) => (io ?? defaultIo).stdout(message);
}

function toAgentErrorPayload(error: unknown, command: string): DevDeckErrorPayload {
  if (error instanceof DevdeckError && error.code === "DD-ERR-0012") {
    return createDevDeckErrorPayload({
      code: "DD_SESSION_API_UNREACHABLE",
      message: error.message,
      hint: error.hint ?? `Run devdeck start --json before devdeck ${command} --json.`,
      severity: "error",
      retryable: true,
      evidence: [],
      nextActions: [
        {
          type: "command",
          command: "devdeck session inspect --json",
          reason: "Inspect the saved DevDeck session state.",
        },
        {
          type: "command",
          command: "devdeck start --json",
          reason: "Start a new DevDeck session.",
        },
      ],
    });
  }

  return createDevDeckErrorPayload({
    code: command === "logs" ? "DD_LOG_QUERY_INVALID" : "DD_INTERNAL_UNEXPECTED",
    message: error instanceof Error ? error.message : "Unexpected DevDeck CLI error.",
    severity: "error",
    retryable: false,
    evidence: [],
    nextActions: [],
  });
}

function formatSessionInspection(inspection: SessionInspection): string {
  if (inspection.state === "missing") {
    return "No active DevDeck session was found.\n";
  }

  if (inspection.state === "running") {
    return `DevDeck session is running.\nPID: ${inspection.session.pid}\nDashboard: ${inspection.session.url}\n`;
  }

  return `${sessionInspectionSummary(inspection)}\n`;
}

function sessionInspectionResult(inspection: SessionInspection): Record<string, unknown> {
  if (inspection.state === "missing") {
    return { state: "missing", sessionPath: inspection.sessionPath };
  }

  return {
    state: inspection.state,
    pid: inspection.session.pid,
    url: inspection.session.url,
    sessionPath: inspection.sessionPath,
    reason: "reason" in inspection ? inspection.reason : undefined,
    expectedProjectRoot: "expectedProjectRoot" in inspection ? inspection.expectedProjectRoot : undefined,
  };
}

function sessionInspectionSummary(inspection: SessionInspection): string {
  if (inspection.state === "missing") {
    return "No active DevDeck session was found.";
  }

  if (inspection.state === "stale") {
    return "DevDeck session state is stale.";
  }

  if (inspection.state === "unreachable") {
    return "DevDeck session API is unreachable.";
  }

  if (inspection.state === "wrong_project") {
    return "Saved DevDeck session belongs to a different project.";
  }

  return "DevDeck session is running.";
}

function errorForInspection(inspection: Exclude<SessionInspection, { state: "running" }>): DevDeckErrorPayload {
  if (inspection.state === "missing") {
    return createDevDeckErrorPayload({
      code: "DD_SESSION_NOT_RUNNING",
      message: "No active DevDeck session was found for this project.",
      hint: "Run devdeck start --json to create a session.",
      severity: "error",
      retryable: false,
      evidence: [{ type: "session", path: inspection.sessionPath, reason: "session_file_missing" }],
      nextActions: [
        {
          type: "command",
          command: "devdeck start --json",
          reason: "Start a new DevDeck session.",
        },
      ],
    });
  }

  if (inspection.state === "wrong_project") {
    return createDevDeckErrorPayload({
      code: "DD_SESSION_WRONG_PROJECT",
      message: "The saved DevDeck session belongs to a different project root.",
      severity: "error",
      retryable: false,
      evidence: [
        {
          type: "session",
          path: inspection.sessionPath,
          pid: inspection.session.pid,
          url: inspection.session.url,
          reason: `expected ${inspection.expectedProjectRoot}`,
        },
      ],
      nextActions: [
        {
          type: "command",
          command: "devdeck session clear-stale --json",
          reason: "Remove session metadata for the wrong project.",
        },
      ],
    });
  }

  return createDevDeckErrorPayload({
    code: inspection.state === "stale" ? "DD_SESSION_STALE" : "DD_SESSION_API_UNREACHABLE",
    message:
      inspection.state === "stale"
        ? "The saved session points to a process that is no longer running."
        : "The saved session process exists, but its API is not reachable.",
    severity: "error",
    retryable: inspection.state === "unreachable",
    evidence: [
      {
        type: "session",
        path: inspection.sessionPath,
        pid: inspection.session.pid,
        url: inspection.session.url,
        reason: "reason" in inspection ? inspection.reason : "api_unreachable",
      },
    ],
    nextActions: [
      {
        type: "command",
        command: "devdeck session clear-stale --json",
        reason: "Remove stale session metadata.",
      },
    ],
  });
}

const defaultIo: CommandIo = {
  stdout: (message) => process.stdout.write(message),
  stderr: (message) => process.stderr.write(message),
};
