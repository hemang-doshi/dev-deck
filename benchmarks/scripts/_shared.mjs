import net from "node:net";
import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { access, appendFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

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

export async function appendTranscript(transcriptPath, command, output) {
  const content = [`$ ${command}`, output.trimEnd(), ""].join("\n");
  await appendFile(transcriptPath, `${content}\n`, "utf8");
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
