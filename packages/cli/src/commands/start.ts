import { spawn } from "node:child_process";
import { access, mkdir } from "node:fs/promises";
import { openSync } from "node:fs";
import path from "node:path";
import { DevdeckError, findDevdeckConfigPath } from "@devdeck/config";
import { createDevDeckErrorPayload } from "../agent-errors.js";
import { createErrorResponse, createSuccessResponse, printJsonResponse } from "../agent-response.js";
import { readSessionState, resolveSessionStatePath } from "../session-state.js";
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

  // 1. Check if a session is already running
  try {
    const state = await readSessionState(configDir);
    if (state.pid) {
      try {
        process.kill(state.pid, 0); // Throws error if process is not running
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
      } catch {
        // PID is not active, session file is stale. Proceed to start.
      }
    }
  } catch {
    // No session state file. Proceed.
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

  // 4. Poll for session.json to be written and HTTP server to become responsive
  const sessionPath = resolveSessionStatePath(configDir);
  let attempts = 0;
  const maxAttempts = waitSeconds * 10;

  while (attempts < maxAttempts) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    try {
      await access(sessionPath);
      const state = await readSessionState(configDir);
      if (state.url && state.pid) {
        if (options.json) {
          printJsonResponse(
            createSuccessResponse(
              {
                command: "start",
                project: state.project,
                summary: "DevDeck started successfully in the background.",
              },
              {
                state: "running",
                pid: state.pid,
                url: state.url,
                logs: logFile,
              },
            ),
            io.stdout,
          );
        } else {
          io.stdout(`DevDeck started successfully in the background!\n`);
          io.stdout(`PID: ${state.pid}\n`);
          io.stdout(`Dashboard: ${state.url}\n`);
          io.stdout(`Logs: ${logFile}\n`);
        }
        return 0;
      }
    } catch {
      // Not ready yet
    }
    attempts += 1;
  }

  const message = `DevDeck background process started but failed to write session state within ${waitSeconds} second${waitSeconds === 1 ? "" : "s"}.`;

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

const defaultIo: CommandIo = {
  stdout: (message) => process.stdout.write(message),
  stderr: (message) => process.stderr.write(message),
};
