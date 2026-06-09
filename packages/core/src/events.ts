import type { LogEvent, LogSeverity, LogStream } from "./log-event.js";

export type DevDeckEventType =
  | "session.started"
  | "session.stopping"
  | "session.stopped"
  | "service.pending"
  | "service.spawned"
  | "service.running"
  | "service.ready"
  | "service.health_changed"
  | "service.log"
  | "service.exited"
  | "service.failed"
  | "action.started"
  | "action.completed"
  | "action.failed";

export type SeverityText = "TRACE" | "DEBUG" | "INFO" | "WARN" | "ERROR" | "FATAL";

export type DevDeckEvent = {
  schemaVersion: "devdeck.event.v1";
  id: string;
  sessionId: string;
  project: string;
  timestamp: string;
  observedTimestamp: string;
  type: DevDeckEventType;
  service?: string;
  stream?: LogStream | "system";
  severityText?: SeverityText;
  severityNumber?: number;
  body?: string;
  attributes?: Record<string, unknown>;
};

export type DevDeckEventInput = Omit<
  DevDeckEvent,
  "schemaVersion" | "id" | "sessionId" | "project" | "timestamp" | "observedTimestamp"
>;

export function createEventId(counter: number): string {
  return `evt_${String(counter).padStart(6, "0")}`;
}

export function severityTextForLogSeverity(severity: LogSeverity): SeverityText {
  if (severity === "error") {
    return "ERROR";
  }

  if (severity === "warning") {
    return "WARN";
  }

  return "INFO";
}

export function severityNumberForText(severity: SeverityText): number {
  const numbers: Record<SeverityText, number> = {
    TRACE: 1,
    DEBUG: 5,
    INFO: 9,
    WARN: 13,
    ERROR: 17,
    FATAL: 21,
  };
  return numbers[severity];
}

export function serviceLogEvent(log: LogEvent): DevDeckEventInput {
  const severityText = severityTextForLogSeverity(log.severity);

  return {
    type: "service.log",
    service: log.service,
    stream: log.stream,
    severityText,
    severityNumber: severityNumberForText(severityText),
    body: log.line,
    attributes: {
      logId: log.id,
      isStackTrace: log.isStackTrace,
      ports: log.ports,
      urls: log.urls,
    },
  };
}
