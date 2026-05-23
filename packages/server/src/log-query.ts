import type { LogEvent, LogSeverity, SessionSnapshot } from "@devdeck/core";

export type LogQueryFilters = {
  service?: string;
  severity?: LogSeverity;
  grep?: string;
  tail: number;
};

export type LogQueryResult = {
  project: string;
  filters: {
    service?: string;
    severity?: LogSeverity;
    grep?: string;
    tail: number;
  };
  totalMatched: number;
  returned: number;
  logs: LogEvent[];
};

export function queryLogs(snapshot: SessionSnapshot, filters: LogQueryFilters): LogQueryResult {
  const matched = snapshot.logs.filter((log) => matchesFilters(log, filters));
  const logs = matched.slice(-filters.tail);

  return {
    project: snapshot.project,
    filters: {
      service: filters.service,
      severity: filters.severity,
      grep: filters.grep,
      tail: filters.tail,
    },
    totalMatched: matched.length,
    returned: logs.length,
    logs,
  };
}

function matchesFilters(log: LogEvent, filters: LogQueryFilters): boolean {
  if (filters.service && log.service !== filters.service) {
    return false;
  }

  if (filters.severity && log.severity !== filters.severity) {
    return false;
  }

  if (filters.grep) {
    return log.line.toLowerCase().includes(filters.grep.toLowerCase());
  }

  return true;
}
