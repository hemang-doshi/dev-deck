import path from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";

export async function ensureParentDirectory(filePath) {
  await mkdir(path.dirname(filePath), { recursive: true });
}

export async function writeTranscript(filePath, text) {
  await ensureParentDirectory(filePath);
  await writeFile(filePath, text, "utf8");
}

export async function readTranscript(filePath) {
  return await readFile(filePath, "utf8");
}

function tryParseJson(line) {
  try {
    return JSON.parse(line);
  } catch {
    return null;
  }
}

export function parseCodexJsonl(source) {
  const events = [];
  const warnings = [];

  for (const line of String(source).split(/\r?\n/)) {
    if (!line.trim()) continue;
    const parsed = tryParseJson(line);
    if (parsed && typeof parsed === "object" && parsed.type) {
      events.push(parsed);
    } else {
      warnings.push(line);
    }
  }

  return { events, warnings };
}

export function renderCodexTranscript(events, warnings = []) {
  const lines = [];

  for (const warning of warnings) {
    lines.push(`! ${warning}`);
  }

  for (const event of events) {
    if (event.type === "item.completed" && event.item?.type === "agent_message") {
      lines.push("assistant>");
      lines.push(event.item.text ?? "");
      lines.push("");
      continue;
    }

    if (event.item?.type === "command_execution") {
      const command = event.item.command ?? "(unknown command)";
      if (event.type === "item.started") {
        lines.push(`$ ${command}`);
      }
      if (event.type === "item.completed") {
        const output = event.item.aggregated_output ?? "";
        if (output.trim()) lines.push(output.trimEnd());
        lines.push("");
      }
    }
  }

  return `${lines.join("\n").trimEnd()}\n`;
}

export function extractCodexMetrics(events) {
  const toolCalls = events.filter((event) =>
    event.item?.type === "command_execution" && event.type === "item.completed"
  ).length;
  const turns = events.filter((event) => event.type === "turn.completed").length;
  const finalMessage = [...events]
    .reverse()
    .find((event) => event.type === "item.completed" && event.item?.type === "agent_message")
    ?.item?.text ?? "";
  const usage = [...events]
    .reverse()
    .find((event) => event.type === "turn.completed" && event.usage)
    ?.usage;

  return {
    toolCalls,
    turns,
    finalMessage,
    providerUsage: usage
      ? {
          inputTokens: usage.input_tokens ?? null,
          outputTokens: usage.output_tokens ?? null,
          totalTokens:
            (usage.input_tokens ?? 0) +
            (usage.output_tokens ?? 0) +
            (usage.reasoning_output_tokens ?? 0),
          reasoningOutputTokens: usage.reasoning_output_tokens ?? null,
          cachedInputTokens: usage.cached_input_tokens ?? null,
        }
      : null,
    providerUsageReason: usage ? null : "Codex CLI did not expose provider token usage.",
  };
}
