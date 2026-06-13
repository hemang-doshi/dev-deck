import fs from "node:fs/promises";
import net from "node:net";
import path from "node:path";

import {
  fixtureRoot,
  pidsDir,
  scenarioStatePath,
  schedulerHeartbeatPath,
  stateDir,
  workerHeartbeatPath,
} from "./fixture-paths.mjs";

const defaultScenario = {
  id: "startup-success",
  runtime: {
    env: { unset: [] },
    api: { crashAfterMs: 0, crashOnDashboardHit: false },
    worker: { noisy: false, stuckJob: false },
    scheduler: { tickMs: 3000 },
    postgres: { readinessDelayMs: 900, migrationFailure: false },
    redis: { unavailable: false },
    externalApi: { mode: "healthy" },
  },
};

export async function ensureStateDirectories() {
  await fs.mkdir(stateDir, { recursive: true });
  await fs.mkdir(pidsDir, { recursive: true });
}

export async function readJson(filePath, fallback) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return fallback;
    }
    throw error;
  }
}

export async function writeJson(filePath, value) {
  await ensureStateDirectories();
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export async function readScenarioState() {
  return await readJson(scenarioStatePath, defaultScenario);
}

export async function loadFixtureEnv() {
  const envFilePath = path.join(fixtureRoot, ".env.fixture");
  const envSource = await fs.readFile(envFilePath, "utf8");
  const env = { ...parseEnvFile(envSource), ...process.env };
  const scenario = await readScenarioState();
  const unset = scenario.runtime?.env?.unset ?? [];

  for (const key of unset) {
    delete env[key];
  }

  return env;
}

function parseEnvFile(source) {
  const env = {};
  for (const line of source.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;
    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim();
    env[key] = value;
  }
  return env;
}

export function log(service, message) {
  process.stdout.write(`[${service}] ${message}\n`);
}

export function logError(service, message) {
  process.stderr.write(`[${service}] ${message}\n`);
}

export async function writeHeartbeat(filePath, payload) {
  await writeJson(filePath, {
    ...payload,
    updatedAt: new Date().toISOString(),
  });
}

export async function recordServicePid(serviceName) {
  await ensureStateDirectories();
  const filePath = path.join(pidsDir, `${serviceName}.pid`);
  await fs.writeFile(filePath, `${process.pid}\n`, "utf8");
  const remove = async () => {
    await fs.rm(filePath, { force: true });
  };
  process.on("exit", () => {
    void remove();
  });
}

export async function removeHeartbeat(serviceName) {
  const filePath = serviceName === "worker" ? workerHeartbeatPath : schedulerHeartbeatPath;
  await fs.rm(filePath, { force: true });
}

export async function tcpCommand({ host, port, command, timeoutMs = 2000 }) {
  return await new Promise((resolve, reject) => {
    const socket = net.createConnection({ host, port });
    const timeout = setTimeout(() => {
      socket.destroy();
      reject(new Error(`Timeout waiting for tcp response from ${host}:${port}`));
    }, timeoutMs);
    let buffer = "";

    socket.setEncoding("utf8");

    socket.on("connect", () => {
      socket.write(`${command}\n`);
    });

    socket.on("data", (chunk) => {
      buffer += chunk;
      if (buffer.includes("\n")) {
        clearTimeout(timeout);
        socket.end();
        resolve(buffer.trim());
      }
    });

    socket.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
  });
}

export async function wait(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export function parseUrlPort(value, fallbackPort) {
  try {
    return new URL(value).port ? Number(new URL(value).port) : fallbackPort;
  } catch {
    return fallbackPort;
  }
}

export async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  let json = null;

  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  return { response, text, json };
}

export function serviceHeartbeatPath(serviceName) {
  return serviceName === "worker" ? workerHeartbeatPath : schedulerHeartbeatPath;
}
