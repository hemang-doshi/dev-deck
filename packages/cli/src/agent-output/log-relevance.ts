import type { AgentEvidence, AgentIssueSeverity } from "./signal.js";

type LogLike = {
  service: string;
  line: string;
  severity: "info" | "warning" | "error";
};

const BOILERPLATE_PATTERNS = [
  /^>\s+\S+/,
  /^>\s+(?:node|tsx|ts-node|vite|next|npm|pnpm|yarn|bun)\b/i,
  /^npm\s+(?:run|warn|notice)\b/i,
  /^(?:\[[0-9]+\]\s*)?>\s+/,
];

const HEARTBEAT_PATTERNS = [
  /\bheartbeat\b/i,
  /\bping\b/i,
  /\bhealth check\b/i,
  /\bcompiled successfully\b/i,
  /\bready in \d+/i,
];

export function isBoilerplateLogLine(line: string): boolean {
  const trimmed = line.trim();
  return trimmed.length === 0 || BOILERPLATE_PATTERNS.some((pattern) => pattern.test(trimmed));
}

export function isErrorLine(line: string): boolean {
  return /\b(error|failed|fatal|exception|crash|lost|refused|panic)\b/i.test(line);
}

export function isWarningLine(line: string): boolean {
  return /\b(warn|warning|degraded|retry|timeout|latency)\b/i.test(line);
}

export function normalizeEvidenceLine(line: string): string {
  const normalized = line.replace(/\s+/g, " ").trim();
  return normalized.length > 140 ? `${normalized.slice(0, 137)}...` : normalized;
}

export function summarizeLogEvidence(logs: LogLike[]): AgentEvidence[] {
  const counts = new Map<string, AgentEvidence>();

  for (const log of logs) {
    const normalized = normalizeEvidenceLine(log.line);
    if (!normalized || isBoilerplateLogLine(normalized)) {
      continue;
    }

    const severity = log.severity === "error"
      ? "error"
      : log.severity === "warning"
        ? "warning"
        : isErrorLine(normalized)
          ? "error"
          : isWarningLine(normalized)
            ? "warning"
            : "info";

    if (severity === "info" && HEARTBEAT_PATTERNS.some((pattern) => pattern.test(normalized))) {
      continue;
    }

    const key = `${log.service}|${severity}|${normalized}`;
    const existing = counts.get(key);
    if (existing) {
      existing.count = (existing.count ?? 1) + 1;
      continue;
    }

    counts.set(key, {
      service: log.service,
      severity,
      line: normalized,
      source: "log",
      count: 1,
    });
  }

  return [...counts.values()]
    .sort((left, right) => compareSeverity(right.severity, left.severity) || compareCount(right.count, left.count))
    .filter((entry, index, entries) => {
      if (entry.severity !== "info") {
        return true;
      }
      return entries.every((candidate) => candidate.severity === "info");
    });
}

function compareSeverity(left: AgentIssueSeverity, right: AgentIssueSeverity): number {
  const rank = { error: 3, warning: 2, info: 1 };
  return rank[left] - rank[right];
}

function compareCount(left = 1, right = 1): number {
  return left - right;
}
