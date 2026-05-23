import { spawn } from "node:child_process";
import { access, mkdir } from "node:fs/promises";
import { openSync } from "node:fs";
import path from "node:path";
import { DevdeckError, findDevdeckConfigPath } from "@devdeck/config";
import { readSessionState, resolveSessionStatePath } from "../session-state.js";
import type { CommandIo } from "./init.js";

export type StartCommandOptions = {
  cwd?: string;
  io?: CommandIo;
  port?: number;
};

export async function runStartCommand(options: StartCommandOptions = {}): Promise<void> {
  const cwd = path.resolve(options.cwd ?? process.cwd());
  const io = options.io ?? defaultIo;

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
        io.stderr(`[DD-ERR-0013] DevDeck is already running at PID ${state.pid} (Dashboard: ${state.url}).\n`);
        io.stderr("Hint: Run 'devdeck stop' to stop the current session first.\n");
        process.exit(1);
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

  io.stdout("Starting DevDeck in the background...\n");

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
  const maxAttempts = 30; // 3 seconds total

  while (attempts < maxAttempts) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    try {
      await access(sessionPath);
      const state = await readSessionState(configDir);
      if (state.url && state.pid) {
        io.stdout(`DevDeck started successfully in the background!\n`);
        io.stdout(`PID: ${state.pid}\n`);
        io.stdout(`Dashboard: ${state.url}\n`);
        io.stdout(`Logs: ${logFile}\n`);
        return;
      }
    } catch {
      // Not ready yet
    }
    attempts += 1;
  }

  throw new DevdeckError(
    "DD-ERR-0014",
    "DevDeck background process started but failed to write session state within 3 seconds.",
    `Check background logs at ${logFile} for details.`
  );
}

const defaultIo: CommandIo = {
  stdout: (message) => process.stdout.write(message),
  stderr: (message) => process.stderr.write(message),
};
