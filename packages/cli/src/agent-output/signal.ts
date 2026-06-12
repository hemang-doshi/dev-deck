import type { SessionSnapshot } from "@devdeck/core";
import type { AgentLogsResponse } from "../agent-client.js";
import { summarizeLogEvidence } from "./log-relevance.js";

export type AgentRuntimeState = "running" | "stopped" | "degraded" | "unknown";

export type AgentIssueSeverity = "error" | "warning" | "info";

export type AgentIssueKind =
  | "service_failed"
  | "health_unreachable"
  | "warning_logs"
  | "error_logs"
  | "restart_loop"
  | "blocked"
  | "unknown";

export type AgentSignal = {
  project: string;
  state: AgentRuntimeState;
  summary: {
    services: number;
    running: number;
    failed: number;
    unhealthy: number;
    warnings: number;
    errors: number;
    restarts: number;
  };
  services: AgentServiceSignal[];
  issues: AgentIssue[];
  evidence: AgentEvidence[];
  nextActions: AgentNextAction[];
  logs?: {
    service?: string;
    matched: number;
    returned: number;
    omitted: number;
  };
};

export type AgentServiceSignal = {
  name: string;
  status: string;
  readiness: string;
  health: string;
  restarts: number;
  issue: AgentIssueKind | "none";
  error?: string;
};

export type AgentIssue = {
  service?: string;
  severity: AgentIssueSeverity;
  kind: AgentIssueKind;
  message: string;
};

export type AgentEvidence = {
  service?: string;
  severity: AgentIssueSeverity;
  line: string;
  source: "log" | "status" | "health" | "event";
  count?: number;
};

export type AgentNextAction = {
  command: string;
  reason: string;
};

export function buildAgentStatusSignal(snapshot: SessionSnapshot): AgentSignal {
  return buildSignalFromSnapshot(snapshot, {
    evidence: [],
  });
}

export function buildAgentSnapshotSignal(
  snapshot: SessionSnapshot,
  options: { tail?: number } = {},
): AgentSignal {
  return buildSignalFromSnapshot(snapshot, {
    evidence: summarizeLogEvidence(snapshot.logs.slice(-(options.tail ?? 120))),
  });
}

export function buildAgentLogsSignal(result: AgentLogsResponse): AgentSignal {
  const evidence = summarizeLogEvidence(result.logs);
  const issues: AgentIssue[] = evidence.map((entry) => ({
    service: entry.service,
    severity: entry.severity,
    kind: entry.severity === "error" ? "error_logs" : entry.severity === "warning" ? "warning_logs" : "unknown",
    message: entry.line,
  }));

  const warnings = evidence.filter((entry) => entry.severity === "warning").length;
  const errors = evidence.filter((entry) => entry.severity === "error").length;
  const state: AgentRuntimeState = errors > 0 ? "degraded" : warnings > 0 ? "degraded" : "unknown";

  return {
    project: result.project,
    state,
    summary: {
      services: result.filters.service ? 1 : countDistinctServices(result.logs),
      running: 0,
      failed: 0,
      unhealthy: 0,
      warnings,
      errors,
      restarts: 0,
    },
    services: [],
    issues,
    evidence,
    nextActions: [],
    logs: {
      service: result.filters.service,
      matched: result.totalMatched,
      returned: result.returned,
      omitted: Math.max(result.totalMatched - evidence.length, 0),
    },
  };
}

function buildSignalFromSnapshot(
  snapshot: SessionSnapshot,
  options: { evidence: AgentEvidence[] },
): AgentSignal {
  const services = snapshot.services.map((service) => {
    const issue = serviceIssue(service);
    return {
      name: service.name,
      status: service.status,
      readiness: service.readiness,
      health: service.health,
      restarts: service.restartCount,
      issue,
      error: service.lastError ?? undefined,
    };
  });

  const serviceIssues = snapshot.services.flatMap((service) => issuesForService(service));
  const logIssues: AgentIssue[] = options.evidence.flatMap<AgentIssue>((entry) => {
    if (entry.severity === "error") {
      return [{
        service: entry.service,
        severity: "error" as const,
        kind: "error_logs" as const,
        message: entry.line,
      }];
    }
    if (entry.severity === "warning") {
      return [{
        service: entry.service,
        severity: "warning" as const,
        kind: "warning_logs" as const,
        message: entry.line,
      }];
    }
    return [];
  });
  const issues = dedupeIssues([...serviceIssues, ...logIssues]);

  const summary = {
    services: snapshot.services.length,
    running: snapshot.services.filter((service) => service.status === "running").length,
    failed: snapshot.services.filter((service) => service.status === "error" || service.status === "exited").length,
    unhealthy: snapshot.services.filter((service) => service.health === "unreachable" || service.health === "degraded" || service.readiness === "failed").length,
    warnings: issues.filter((issue) => issue.severity === "warning").length,
    errors: issues.filter((issue) => issue.severity === "error").length,
    restarts: snapshot.services.reduce((sum, service) => sum + service.restartCount, 0),
  };

  return {
    project: snapshot.project,
    state: deriveRuntimeState(snapshot, summary),
    summary,
    services,
    issues,
    evidence: options.evidence,
    nextActions: [],
  };
}

function deriveRuntimeState(
  snapshot: SessionSnapshot,
  summary: AgentSignal["summary"],
): AgentRuntimeState {
  if (snapshot.services.length === 0) {
    return "unknown";
  }

  if (summary.failed > 0 || summary.unhealthy > 0 || summary.errors > 0) {
    return "degraded";
  }

  if (summary.running === 0) {
    return "stopped";
  }

  if (summary.running > 0) {
    return "running";
  }

  return "unknown";
}

function serviceIssue(service: SessionSnapshot["services"][number]): AgentServiceSignal["issue"] {
  if (service.status === "error" || service.status === "exited") {
    return "service_failed";
  }
  if (service.status === "blocked") {
    return "blocked";
  }
  if (service.health === "unreachable" || service.health === "degraded" || service.readiness === "failed") {
    return "health_unreachable";
  }
  if (service.restartCount > 0) {
    return "restart_loop";
  }
  return "none";
}

function issuesForService(service: SessionSnapshot["services"][number]): AgentIssue[] {
  const issues: AgentIssue[] = [];

  if (service.status === "error" || service.status === "exited") {
    issues.push({
      service: service.name,
      severity: "error",
      kind: "service_failed",
      message: service.lastError ?? `${service.name} is ${service.status}`,
    });
  }

  if (service.status === "blocked") {
    issues.push({
      service: service.name,
      severity: "error",
      kind: "blocked",
      message: service.blockedBy.length > 0
        ? `blocked by ${service.blockedBy.join(", ")}`
        : (service.lastError ?? "service dependencies were not satisfied"),
    });
  }

  if (service.health === "unreachable" || service.health === "degraded" || service.readiness === "failed") {
    issues.push({
      service: service.name,
      severity: service.health === "degraded" ? "warning" : "error",
      kind: "health_unreachable",
      message: service.lastError ?? `health=${service.health} readiness=${service.readiness}`,
    });
  }

  if (service.restartCount > 0) {
    issues.push({
      service: service.name,
      severity: service.restartCount > 1 ? "warning" : "info",
      kind: "restart_loop",
      message: `restarted ${service.restartCount} time${service.restartCount === 1 ? "" : "s"}`,
    });
  }

  return issues;
}

function dedupeIssues(issues: AgentIssue[]): AgentIssue[] {
  const seen = new Set<string>();
  const result: AgentIssue[] = [];

  for (const issue of issues) {
    const key = `${issue.severity}|${issue.service ?? ""}|${issue.kind}|${issue.message}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(issue);
  }

  return result;
}

function countDistinctServices(logs: AgentLogsResponse["logs"]): number {
  return new Set(logs.map((log) => log.service)).size;
}
