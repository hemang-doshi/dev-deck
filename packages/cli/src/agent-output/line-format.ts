import type { SessionSnapshot } from "@devdeck/core";
import type { AgentLogsResponse } from "../agent-client.js";
import { formatAgentDiagnosis as formatDiagnosis } from "./diagnosis.js";
import {
  defaultAgentLogsPolicy,
  defaultAgentSnapshotPolicy,
  defaultAgentStatusPolicy,
  type AgentOutputPolicy,
} from "./policy.js";
import { suggestNextActions } from "./next-actions.js";
import {
  buildAgentLogsSignal,
  buildAgentSnapshotSignal,
  buildAgentStatusSignal,
  type AgentServiceSignal,
  type AgentSignal,
} from "./signal.js";

export function formatAgentStatus(snapshot: SessionSnapshot): string {
  const signal = withNextActions(buildAgentStatusSignal(snapshot));
  return formatSignal(signal, defaultAgentStatusPolicy);
}

export function formatAgentSnapshot(
  snapshot: SessionSnapshot,
  options: { tail?: number } = {},
): string {
  const signal = withNextActions(buildAgentSnapshotSignal(snapshot, options));
  return formatSignal(signal, defaultAgentSnapshotPolicy);
}

export function formatAgentLogs(result: AgentLogsResponse): string {
  const signal = withNextActions(buildAgentLogsSignal(result));
  return formatLogSignal(signal, defaultAgentLogsPolicy);
}

export function formatAgentDiagnosis(snapshot: SessionSnapshot): string {
  return formatDiagnosis(snapshot);
}

function withNextActions(signal: AgentSignal): AgentSignal {
  return {
    ...signal,
    nextActions: suggestNextActions(signal),
  };
}

function formatSignal(signal: AgentSignal, policy: AgentOutputPolicy): string {
  const lines = [
    `STATE ${signal.state} svc=${signal.summary.services} fail=${signal.summary.failed} bad=${signal.summary.unhealthy} warn=${signal.summary.warnings} err=${signal.summary.errors}`,
  ];

  const serviceLines = selectServices(signal, policy);
  if (serviceLines.length === 0 && signal.state === "running" && signal.issues.length === 0) {
    lines.push("SERVICES all_ready");
  } else {
    lines.push(...serviceLines.map(formatServiceLine));
  }

  lines.push(...signal.issues.slice(0, policy.maxIssues).map((issue) =>
    `I ${issue.severity} ${issue.service ?? "-"} ${issue.kind} ${quote(issue.message)}`));
  lines.push(...signal.evidence.slice(0, policy.maxEvidence).map((evidence) =>
    `E ${evidence.severity} ${evidence.service ?? "-"} ${quote(withCount(evidence.line, evidence.count))}`));
  lines.push(...signal.nextActions.map((action) => `NEXT ${action.command} # ${action.reason}`));

  return `${lines.join("\n")}\n`;
}

function formatLogSignal(signal: AgentSignal, policy: AgentOutputPolicy): string {
  const omitted = signal.logs?.matched !== undefined
    ? Math.max(signal.logs.matched - signal.evidence.length, 0)
    : 0;
  const service = signal.logs?.service ?? "*";
  const lines = [
    `LOGS ${service} matched=${signal.logs?.matched ?? 0} returned=${Math.min(signal.evidence.length, policy.maxEvidence)} omitted=${omitted}`,
    ...signal.issues.slice(0, policy.maxIssues).map((issue) =>
      `I ${issue.severity} ${issue.service ?? "-"} ${issue.kind} ${quote(issue.message)}`),
    ...signal.evidence.slice(0, policy.maxEvidence).map((evidence) =>
      `E ${evidence.severity} ${evidence.service ?? "-"} ${quote(withCount(evidence.line, evidence.count))}`),
    ...signal.nextActions.map((action) => `NEXT ${action.command} # ${action.reason}`),
  ];

  return `${lines.join("\n")}\n`;
}

function selectServices(signal: AgentSignal, policy: AgentOutputPolicy): AgentServiceSignal[] {
  const unhealthy = signal.services.filter((service) => service.issue !== "none");
  if (unhealthy.length > 0) {
    return unhealthy.slice(0, policy.maxServices);
  }

  if (policy.includeHealthyServices === "always") {
    return signal.services.slice(0, policy.maxServices);
  }

  if (policy.includeHealthyServices === "only-if-small" && signal.services.length <= policy.maxServices) {
    return signal.services;
  }

  return [];
}

function formatServiceLine(service: AgentServiceSignal): string {
  const parts = [
    `S ${service.name} ${service.status}`,
    `ready=${service.readiness}`,
    `h=${service.health}`,
    `r=${service.restarts}`,
    `issue=${service.issue}`,
  ];
  if (service.error) {
    parts.push(`msg=${quote(service.error)}`);
  }
  return parts.join(" ");
}

function quote(value: string): string {
  return JSON.stringify(value);
}

function withCount(line: string, count = 1): string {
  return count > 1 ? `${line} x${count}` : line;
}
