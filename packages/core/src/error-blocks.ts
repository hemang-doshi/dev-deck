import type { DevDeckEvent } from "./events.js";

export type ErrorBlock = {
  id: string;
  service: string;
  firstEventId: string;
  lastEventId: string;
  startedAt: string;
  endedAt?: string;
  severity: "warning" | "error" | "fatal";
  title: string;
  lines: string[];
  probableCodes: string[];
};

export function buildErrorBlocks(events: DevDeckEvent[]): ErrorBlock[] {
  const blocks: ErrorBlock[] = [];
  let current: ErrorBlock | null = null;

  for (const event of events) {
    if (event.type !== "service.log" || !event.service || !event.body) {
      current = null;
      continue;
    }

    if (current && isContinuation(event.body)) {
      current.lines.push(event.body);
      current.lastEventId = event.id;
      current.endedAt = event.timestamp;
      for (const code of probableCodes(event.body)) {
        if (!current.probableCodes.includes(code)) {
          current.probableCodes.push(code);
        }
      }
      continue;
    }

    if (!isCandidate(event)) {
      current = null;
      continue;
    }

    current = {
      id: `err_${String(blocks.length + 1).padStart(6, "0")}`,
      service: event.service,
      firstEventId: event.id,
      lastEventId: event.id,
      startedAt: event.timestamp,
      endedAt: event.timestamp,
      severity: classifySeverity(event),
      title: event.body,
      lines: [event.body],
      probableCodes: probableCodes(event.body),
    };
    blocks.push(current);
  }

  return blocks;
}

function isCandidate(event: DevDeckEvent): boolean {
  const body = event.body ?? "";
  return (
    event.stream === "stderr" ||
    event.severityText === "ERROR" ||
    event.severityText === "FATAL" ||
    event.severityText === "WARN" ||
    /\b(error|exception|failed|EADDRINUSE|warning)\b/i.test(body) ||
    isContinuation(body)
  );
}

function isContinuation(line: string): boolean {
  return /^\s+at\s/.test(line) || /^\s+\w/.test(line) || /^Caused by:/i.test(line);
}

function classifySeverity(event: DevDeckEvent): ErrorBlock["severity"] {
  const body = event.body ?? "";
  if (event.severityText === "FATAL" || /\bEADDRINUSE\b/.test(body)) {
    return "fatal";
  }

  if (event.severityText === "WARN" || /\bwarning\b/i.test(body)) {
    return "warning";
  }

  return "error";
}

function probableCodes(line: string): string[] {
  const codes = line.match(/\bE[A-Z0-9_]+\b/g) ?? [];
  return [...new Set(codes)];
}
