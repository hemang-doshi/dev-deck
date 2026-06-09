import type { LogEvent, LogSeverity, LogStream, SessionSnapshot } from "@devdeck/core";

export type LogQueryFilters = {
  service?: string;
  severity?: LogSeverity;
  stream?: LogStream;
  grep?: string;
  errors?: boolean;
  context?: number;
  since?: string;
  tail: number;
};

export type LogQueryResult = {
  project: string;
  filters: {
    service?: string;
    severity?: LogSeverity;
    stream?: LogStream;
    grep?: string;
    errors?: boolean;
    context?: number;
    since?: string;
    tail: number;
  };
  totalMatched: number;
  returned: number;
  logs: LogEvent[];
};

export function queryLogs(snapshot: SessionSnapshot, filters: LogQueryFilters): LogQueryResult {
  const logsAfterCursor = applySince(snapshot.logs, filters.since);
  const matched = logsAfterCursor.filter((log, index) => matchesFilters(log, filters, logsAfterCursor, index));
  const logs = matched.slice(-filters.tail);

  return {
    project: snapshot.project,
    filters: {
      service: filters.service,
      severity: filters.severity,
      stream: filters.stream,
      grep: filters.grep,
      errors: filters.errors,
      context: filters.context,
      since: filters.since,
      tail: filters.tail,
    },
    totalMatched: matched.length,
    returned: logs.length,
    logs,
  };
}

function matchesFilters(
  log: LogEvent,
  filters: LogQueryFilters,
  logs: LogEvent[],
  index: number,
): boolean {
  if (filters.service && log.service !== filters.service) {
    return false;
  }

  if (filters.severity && log.severity !== filters.severity) {
    return false;
  }

  if (filters.stream && log.stream !== filters.stream) {
    return false;
  }

  if (filters.errors && !isErrorLog(log)) {
    if (filters.context === undefined || filters.context < 1) {
      return false;
    }

    const nearby = logs.some((candidate, candidateIndex) =>
      Math.abs(candidateIndex - index) <= filters.context! && isErrorLog(candidate),
    );
    if (!nearby) {
      return false;
    }
  }

  if (filters.grep) {
    return log.line.toLowerCase().includes(filters.grep.toLowerCase());
  }

  return true;
}

function applySince(logs: LogEvent[], since?: string): LogEvent[] {
  if (!since) {
    return logs;
  }

  const rawLogId = since.replace(/^log_/, "");
  if (/^\d+$/.test(rawLogId)) {
    const logId = Number.parseInt(rawLogId, 10);
    return logs.filter((log) => log.id > logId);
  }

  return logs.filter((log) => log.timestamp > since);
}

function isErrorLog(log: LogEvent): boolean {
  return (
    log.severity === "error" ||
    log.stream === "stderr" ||
    /\b(error|exception|failed|EADDRINUSE)\b/i.test(log.line)
  );
}
