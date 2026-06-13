import net from "node:net";
import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { access, appendFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  countTextWithTokenizers,
  getTokenizerConfiguration,
} from "./tokenizers.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const repoRoot = path.resolve(__dirname, "../..");
export const benchmarksRoot = path.join(repoRoot, "benchmarks");
export const fixturesRoot = path.join(benchmarksRoot, "fixtures");
export const resultsRoot = path.join(benchmarksRoot, "results");
export const cliDistPath = path.join(repoRoot, "packages/cli/dist/index.js");

export function timestampId() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

export async function createRunDirectory(requestedRunDir) {
  const runDir = requestedRunDir ? path.resolve(requestedRunDir) : path.join(resultsRoot, timestampId());
  await mkdir(runDir, { recursive: true });
  return runDir;
}

export async function ensureEmptyDirectory(directory) {
  await rm(directory, { recursive: true, force: true });
  await mkdir(directory, { recursive: true });
}

export function getFixtureDirectory(fixture = "node-api-worker") {
  return path.join(fixturesRoot, fixture);
}

export async function isPortFree(port, host = "127.0.0.1") {
  return await new Promise((resolve) => {
    const server = net.createServer();

    server.once("error", () => {
      resolve(false);
    });

    server.once("listening", () => {
      server.close(() => resolve(true));
    });

    server.listen(port, host);
  });
}

export function getNodeVersion() {
  return process.version;
}

export function getEnvironmentSummary() {
  return {
    os: `${os.platform()} ${os.release()}`,
    node: getNodeVersion(),
    date: new Date().toISOString(),
  };
}

export function approximateTokens(characters) {
  return Math.ceil(characters / 4);
}

export function formatTranscriptEntry(command, output) {
  const content = [`$ ${command}`, output.trimEnd(), ""].join("\n");
  return `${content}\n`;
}

export async function appendTranscript(transcriptPath, command, output) {
  const content = formatTranscriptEntry(command, output);
  await appendFile(transcriptPath, content, "utf8");
  return content;
}

export async function createCommandEvent({
  id,
  mode,
  scenario,
  commandLabel,
  command,
  transcriptCommand = commandLabel,
  category,
  output,
  startedAt,
  endedAt,
  exitCode,
}) {
  const transcriptEntry = formatTranscriptEntry(transcriptCommand, output);
  const { primaryTokenizer, tokenizers } = getTokenizerConfiguration();
  const count = await countTextWithTokenizers(transcriptEntry, { tokenizers });

  return {
    id,
    mode,
    scenario,
    commandLabel,
    command,
    category,
    output,
    characters: count.characters,
    tokens: count.tokens,
    primaryTokens: count.tokens[primaryTokenizer],
    primaryTokenizer,
    approxTokens: count.tokens["approx-char-div-4"] ?? null,
    startedAt,
    endedAt,
    exitCode,
  };
}

export async function recordCommandEvent({
  events,
  transcriptPath,
  recordTranscript = true,
  ...eventData
}) {
  const event = await createCommandEvent(eventData);

  if (recordTranscript) {
    await appendTranscript(
      transcriptPath,
      eventData.transcriptCommand ?? event.commandLabel,
      eventData.output,
    );
    events.push(event);
  }

  return event;
}

export async function writeCommandEvents(directory, events) {
  const commandEventsPath = path.join(directory, "command-events.json");
  await writeJson(commandEventsPath, events);
  return commandEventsPath;
}

export async function listRunModes(runDir) {
  const entries = await import("node:fs/promises").then(({ readdir }) =>
    readdir(runDir, { withFileTypes: true }),
  );

  const modes = [];
  for (const entry of entries) {
    if (
      entry.isDirectory() &&
      await fileExists(path.join(runDir, entry.name, "transcript.txt"))
    ) {
      modes.push(entry.name);
    }
  }

  const preferredOrder = [
    "baseline",
    "devdeck",
    "devdeck-full",
    "devdeck-status-only",
    "devdeck-snapshot-only",
    "devdeck-logs-only",
    "devdeck-agent-status",
    "devdeck-agent-snapshot",
    "devdeck-agent-logs",
    "devdeck-agent-full",
  ];
  return modes.sort((left, right) => {
    const leftIndex = preferredOrder.indexOf(left);
    const rightIndex = preferredOrder.indexOf(right);
    if (leftIndex !== -1 || rightIndex !== -1) {
      return (leftIndex === -1 ? preferredOrder.length : leftIndex) -
        (rightIndex === -1 ? preferredOrder.length : rightIndex);
    }
    return left.localeCompare(right);
  });
}

function splitTranscriptEntries(transcript) {
  const starts = [...transcript.matchAll(/^\$ /gm)].map((match) => match.index);
  return starts.map((start, index) =>
    transcript.slice(start, starts[index + 1] ?? transcript.length),
  );
}

export async function writeCommandAttribution(runDir, requestedModes, options = {}) {
  const modes = requestedModes ?? await listRunModes(runDir);
  const { primaryTokenizer, tokenizers } = getTokenizerConfiguration(options);
  const attribution = {
    primaryTokenizer,
    tokenizers,
    modes: {},
  };

  for (const mode of modes) {
    const eventsPath = path.join(runDir, mode, "command-events.json");
    if (!(await fileExists(eventsPath))) {
      continue;
    }

    const commands = await readJson(eventsPath);
    const transcript = await readFile(path.join(runDir, mode, "transcript.txt"), "utf8");
    const transcriptEntries = splitTranscriptEntries(transcript);
    const enrichedCommands = [];

    for (const [index, command] of commands.entries()) {
      const count = command.tokens && tokenizers.every((tokenizer) =>
        Number.isInteger(command.tokens[tokenizer])
      )
        ? {
            characters: command.characters,
            tokens: command.tokens,
          }
        : await countTextWithTokenizers(transcriptEntries[index] ?? "", { tokenizers });
      enrichedCommands.push({
        ...command,
        characters: count.characters,
        tokens: count.tokens,
        primaryTokens: count.tokens[primaryTokenizer],
        primaryTokenizer,
        approxTokens: count.tokens["approx-char-div-4"] ?? null,
      });
    }

    const characters = enrichedCommands.reduce(
      (total, event) => total + event.characters,
      0,
    );
    const tokenTotals = Object.fromEntries(
      tokenizers.map((tokenizer) => [
        tokenizer,
        enrichedCommands.reduce(
          (total, event) => total + event.tokens[tokenizer],
          0,
        ),
      ]),
    );

    attribution.modes[mode] = {
      characters,
      tokens: tokenTotals,
      primaryTokens: tokenTotals[primaryTokenizer],
      approxTokens: tokenTotals["approx-char-div-4"] ?? null,
      commands: enrichedCommands,
    };
  }

  const attributionPath = path.join(runDir, "command-attribution.json");
  await writeJson(attributionPath, attribution);
  return attribution;
}

export async function runCommand(command, options = {}) {
  const { cwd = repoRoot, env, allowFailure = false } = options;

  return await new Promise((resolve, reject) => {
    const child = spawn(command, {
      cwd,
      env: { ...process.env, ...env },
      shell: true,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", reject);
    child.on("close", (code) => {
      const result = {
        code: code ?? 1,
        stdout,
        stderr,
        combined: `${stdout}${stderr}`,
      };

      if (!allowFailure && result.code !== 0) {
        reject(
          new Error(`Command failed (${result.code}): ${command}\n${result.combined.trim()}`),
        );
        return;
      }

      resolve(result);
    });
  });
}

export function spawnLoggedProcess(command, args, options) {
  const stdoutStream = createWriteStream(options.stdoutPath, { flags: "a" });
  const stderrStream = createWriteStream(options.stderrPath ?? options.stdoutPath, { flags: "a" });
  const child = spawn(command, args, {
    cwd: options.cwd,
    env: { ...process.env, ...options.env },
    stdio: ["ignore", "pipe", "pipe"],
  });

  child.stdout.pipe(stdoutStream);
  child.stderr.pipe(stderrStream);

  return {
    child,
    closeStreams: async () => {
      stdoutStream.end();
      stderrStream.end();
    },
  };
}

export async function waitForHttp(url, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      const text = await response.text();
      return {
        status: response.status,
        body: text,
      };
    } catch (error) {
      lastError = error;
      await sleep(200);
    }
  }

  throw new Error(`Timed out waiting for ${url}: ${lastError instanceof Error ? lastError.message : "unknown error"}`);
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function stopProcess(child, label) {
  if (!child.pid || child.exitCode !== null) {
    return;
  }

  child.kill("SIGTERM");

  const exited = await new Promise((resolve) => {
    const timer = setTimeout(() => {
      if (child.exitCode === null) {
        child.kill("SIGKILL");
      }
      resolve(false);
    }, 5000);

    child.once("exit", () => {
      clearTimeout(timer);
      resolve(true);
    });
  });

  if (!exited && child.exitCode === null) {
    throw new Error(`Unable to stop ${label}`);
  }
}

export async function tailFile(filePath, lines = 20) {
  const source = await readFile(filePath, "utf8");
  return source.trimEnd().split("\n").slice(-lines).join("\n");
}

export async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

export async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

export function parseRunDirArgument(argv) {
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--run-dir") {
      return argv[index + 1];
    }
  }

  return argv[0];
}

export function quote(value) {
  return `"${value.replaceAll("\"", "\\\"")}"`;
}
