import type { LogSeverity, LogStream } from "./log-event.js";

export type ClassifiedLogLine = {
  isStackTrace: boolean;
  ports: number[];
  severity: LogSeverity;
  urls: string[];
};

export function classifyLogLine(line: string, stream: LogStream): ClassifiedLogLine {
  const lowered = line.toLowerCase();
  const urls = [...line.matchAll(/https?:\/\/[^\s)]+/g)].map((match) => match[0]);
  const ports = [...line.matchAll(/\b:(\d{2,5})\b/g)]
    .map((match) => Number(match[1]))
    .filter((port) => port > 0 && port <= 65535);
  const isStackTrace =
    /^\s*at\s.+/.test(line) || /^\s*[A-Za-z0-9_$]+\s*\(.+\)$/.test(line);

  if (/\b(error|exception|failed|fatal)\b/.test(lowered)) {
    return { severity: "error", urls, ports, isStackTrace };
  }

  if (/\b(warn|warning|deprecated)\b/.test(lowered)) {
    return { severity: "warning", urls, ports, isStackTrace };
  }

  return {
    severity: stream === "stderr" ? "error" : "info",
    urls,
    ports,
    isStackTrace,
  };
}
