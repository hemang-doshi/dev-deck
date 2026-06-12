import type { SessionSnapshot } from "@devdeck/core";
import type { AgentLogsResponse } from "./agent-client.js";
import {
  formatAgentLogs as formatCompactAgentLogs,
  formatAgentSnapshot as formatCompactAgentSnapshot,
  formatAgentStatus as formatCompactAgentStatus,
} from "./agent-output/line-format.js";

export function formatStatus(snapshot: SessionSnapshot): string {
  const lines = [
    `Project: ${snapshot.project}`,
    `Started: ${snapshot.startedAt}`,
    "Services:",
    ...snapshot.services.map(
      (service) =>
        `- ${service.name} | status=${service.status} | readiness=${service.readiness} | health=${service.health} | pid=${service.pid ?? "none"} | restarts=${service.restartCount}${service.blockedBy.length > 0 ? ` | blockedBy=${service.blockedBy.join(",")}` : ""}`,
    ),
  ];

  return `${lines.join("\n")}\n`;
}

export function formatLogs(result: AgentLogsResponse): string {
  const header = [
    `Project: ${result.project}`,
    `Matched: ${result.totalMatched}`,
    `Returned: ${result.returned}`,
  ];
  const logs = result.logs.map(
    (log) => `${log.timestamp} ${log.service} ${log.severity.toUpperCase()} ${log.stream} ${log.line}`,
  );

  return `${[...header, ...logs].join("\n")}\n`;
}

export function formatSnapshot(snapshot: SessionSnapshot, tail: number): string {
  const logs = snapshot.logs.slice(-tail);
  const lines = [
    "# Agent DevDeck Snapshot",
    "",
    `Project: ${snapshot.project}`,
    `Started: ${snapshot.startedAt}`,
    "",
    "## Services",
    ...snapshot.services.map(
      (service) =>
        `- ${service.name}: status=${service.status}, readiness=${service.readiness}, health=${service.health}, blockedBy=${service.blockedBy.join(",") || "none"}, restarts=${service.restartCount}, error=${service.lastError ?? "none"}`,
    ),
    "",
    "## Logs",
    ...logs.map(
      (log) => `- ${log.timestamp} [${log.service}] ${log.severity.toUpperCase()} ${log.line}`,
    ),
    "",
  ];

  return lines.join("\n");
}

export const formatAgentStatus = formatCompactAgentStatus;
export const formatAgentSnapshot = formatCompactAgentSnapshot;
export const formatAgentLogs = formatCompactAgentLogs;
