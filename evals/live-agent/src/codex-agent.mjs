import { spawn } from "node:child_process";
import path from "node:path";
import { chmod, readFile, writeFile } from "node:fs/promises";

import {
  ensureParentDirectory,
  extractCodexMetrics,
  parseCodexJsonl,
  renderCodexTranscript,
  writeTranscript,
} from "./transcript.mjs";

function spawnCommand(command, args, { cwd, env, stdin } = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd,
      env: { ...process.env, ...env },
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      resolve({ ok: false, code: null, stdout, stderr, error });
    });

    child.on("close", (code) => {
      resolve({ ok: (code ?? 1) === 0, code: code ?? 1, stdout, stderr });
    });

    child.stdin.end(stdin ?? "");
  });
}

export async function detectCodexCli() {
  const which = await spawnCommand("which", ["codex"]);
  if (!which.ok) {
    return { available: false, reason: "Codex CLI was not found on PATH." };
  }

  const version = await spawnCommand("codex", ["--version"]);
  if (!version.ok) {
    return { available: false, reason: `Codex CLI exists but '--version' failed: ${version.stderr || version.stdout}` };
  }

  const execHelp = await spawnCommand("codex", ["exec", "--help"]);
  if (!execHelp.ok) {
    return { available: false, reason: "Codex CLI is available but 'codex exec --help' failed." };
  }

  const helpText = `${execHelp.stdout}\n${execHelp.stderr}`;
  const supportsJson = helpText.includes("--json");
  const supportsOutputLastMessage = helpText.includes("--output-last-message");
  const supportsPromptFromStdin = helpText.includes("read from stdin");

  if (!supportsJson || !supportsOutputLastMessage || !supportsPromptFromStdin) {
    return {
      available: false,
      reason: "Codex CLI is available but no supported non-interactive invocation was detected.",
      command: "codex",
      version: version.stdout.trim(),
    };
  }

  return {
    available: true,
    command: "codex",
    version: version.stdout.trim(),
    supportsJson,
    supportsOutputLastMessage,
    supportsPromptFromStdin,
  };
}

export async function installDevDeckShim({ workspacePath, cliPath }) {
  const shimPath = path.join(workspacePath, "devdeck");
  const script = `#!/usr/bin/env bash\nnode ${JSON.stringify(cliPath)} "$@"\n`;
  await writeFile(shimPath, script, "utf8");
  await chmod(shimPath, 0o755);
  return shimPath;
}

export async function runCodexAgent({
  prompt,
  cwd,
  env,
  timeoutMs,
  transcriptPath,
  rawEventsPath,
  finalMessagePath,
}) {
  await ensureParentDirectory(transcriptPath);
  await ensureParentDirectory(rawEventsPath);
  await ensureParentDirectory(finalMessagePath);

  const args = [
    "exec",
    "--json",
    "--color",
    "never",
    "--full-auto",
    "-o",
    finalMessagePath,
    "-C",
    cwd,
    "-",
  ];

  const startedAt = new Date().toISOString();
  const result = await new Promise((resolve) => {
    const child = spawn("codex", args, {
      cwd,
      env: { ...process.env, ...env },
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, timeoutMs);

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      resolve({ code: null, stdout, stderr, error, timedOut });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code: code ?? 1, stdout, stderr, timedOut });
    });
    child.stdin.end(prompt);
  });
  const endedAt = new Date().toISOString();

  const rawOutput = `${result.stdout}${result.stderr}`;
  await writeFile(rawEventsPath, rawOutput, "utf8");

  const parsed = parseCodexJsonl(rawOutput);
  const transcript = renderCodexTranscript(parsed.events, parsed.warnings);
  await writeTranscript(transcriptPath, transcript);

  let finalAnswer = "";
  try {
    finalAnswer = await readFile(finalMessagePath, "utf8");
  } catch {
    finalAnswer = extractCodexMetrics(parsed.events).finalMessage;
  }

  const metrics = extractCodexMetrics(parsed.events);
  const authenticationFailed = /auth|login|unauth|tokenrefreshfailed/i.test(rawOutput);
  const timedOut = Boolean(result.timedOut);

  return {
    startedAt,
    endedAt,
    durationMs: new Date(endedAt).getTime() - new Date(startedAt).getTime(),
    transcript,
    rawOutput,
    finalAnswer: finalAnswer.trim(),
    toolCalls: metrics.toolCalls,
    turns: metrics.turns,
    exitCode: result.code ?? 1,
    providerUsage: metrics.providerUsage,
    providerUsageReason: metrics.providerUsageReason,
    error: result.error ? String(result.error) : null,
    authenticationFailed,
    timedOut,
  };
}
