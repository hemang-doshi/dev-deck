import type { SessionSnapshot } from "@devdeck/core";

export type DiagnosisRoot =
  | "missing_env"
  | "port_conflict"
  | "blocked_dependency"
  | "readiness_timeout"
  | "health_unreachable"
  | "service_crash"
  | "restart_loop"
  | "warning_logs"
  | "unknown";

export type AgentDiagnosis = {
  state: "degraded" | "warning" | "unknown" | "running";
  root: DiagnosisRoot;
  service?: string;
  confidence: number;
  cause: string;
  evidence: Array<{
    severity: "error" | "warning" | "info";
    service?: string;
    line: string;
  }>;
  nextAction: {
    command: string;
    reason: string;
  };
};

type ServiceSnapshot = SessionSnapshot["services"][number];
type LogSnapshot = SessionSnapshot["logs"][number];

export function diagnoseSnapshot(snapshot: SessionSnapshot): AgentDiagnosis {
  const failingServices = prioritizeServices(snapshot.services);

  for (const service of failingServices) {
    const diagnosis = diagnoseService(snapshot, service);
    if (diagnosis) {
      return diagnosis;
    }
  }

  const warningDiagnosis = diagnoseWarning(snapshot);
  if (warningDiagnosis) {
    return warningDiagnosis;
  }

  return {
    state: snapshot.services.some((service) => service.status === "running") ? "running" : "unknown",
    root: "unknown",
    confidence: 0.4,
    cause: "No deterministic root cause identified from bounded session state.",
    evidence: [],
    nextAction: {
      command: "devdeck logs --agent --severity error --tail 40",
      reason: "inspect bounded failure evidence",
    },
  };
}

export function formatAgentDiagnosis(snapshot: SessionSnapshot): string {
  const diagnosis = diagnoseSnapshot(snapshot);
  const lines = [
    `DIAG ${diagnosis.state} root=${diagnosis.root} svc=${diagnosis.service ?? "-"} conf=${diagnosis.confidence.toFixed(2)}`,
    `CAUSE ${diagnosis.cause}`,
    ...diagnosis.evidence.slice(0, 3).map((evidence) =>
      `E ${evidence.severity.toUpperCase()} ${evidence.service ?? "-"} ${JSON.stringify(evidence.line)}`),
    `NEXT ${diagnosis.nextAction.command} # ${diagnosis.nextAction.reason}`,
  ];
  return `${lines.join("\n")}\n`;
}

export function detectRootCauseFromText(text: string): DiagnosisRoot | null {
  const normalized = text.toLowerCase();

  if (/missing required env|missing required environment variable|session_secret|database_url|redis_url/.test(normalized)) {
    return "missing_env";
  }

  if (/eaddrinuse|address already in use|port .* already in use/.test(normalized)) {
    return "port_conflict";
  }

  if (/timed out waiting for readiness probe|readiness probe/.test(normalized)) {
    return "readiness_timeout";
  }

  if (/health=unreachable|health probe|unreachable/.test(normalized)) {
    return "health_unreachable";
  }

  if (/exited with code|simulated crash after startup|crash/.test(normalized)) {
    return "service_crash";
  }

  if (/queue latency above threshold|warning/.test(normalized)) {
    return "warning_logs";
  }

  return null;
}

function diagnoseService(snapshot: SessionSnapshot, service: ServiceSnapshot): AgentDiagnosis | null {
  const serviceLogs = selectRelevantLogs(snapshot, service.name);
  const evidence = collectEvidence(service, serviceLogs);
  const textPool = [service.lastError, ...evidence.map((entry) => entry.line)].filter(Boolean).join("\n");
  const inferredRoot = detectRootCauseFromText(textPool);

  if (inferredRoot === "missing_env") {
    const variable = extractMissingEnvVariable(textPool);
    return {
      state: "degraded",
      root: "missing_env",
      service: service.name,
      confidence: 0.95,
      cause: `${service.name} missing required environment variable ${variable ?? "required env"}`,
      evidence,
      nextAction: {
        command: "devdeck stop --agent",
        reason: "cleanup failed startup",
      },
    };
  }

  if (inferredRoot === "port_conflict") {
    const port = extractPort(textPool);
    return {
      state: "degraded",
      root: "port_conflict",
      service: service.name,
      confidence: 0.92,
      cause: `${service.name} port already in use${port ? ` on ${port}` : ""}`,
      evidence,
      nextAction: {
        command: "devdeck stop --agent",
        reason: "cleanup partial stack",
      },
    };
  }

  if (service.status === "blocked" || service.blockedBy.length > 0) {
    return {
      state: "degraded",
      root: "blocked_dependency",
      service: service.name,
      confidence: 0.9,
      cause: `${service.name} is blocked by ${service.blockedBy.join(", ") || "unsatisfied dependencies"}`,
      evidence,
      nextAction: {
        command: "devdeck stop --agent",
        reason: "cleanup blocked startup",
      },
    };
  }

  if (service.restartCount > 1 && service.status !== "running") {
    return {
      state: "degraded",
      root: "restart_loop",
      service: service.name,
      confidence: 0.86,
      cause: `${service.name} restarted ${service.restartCount} times without stabilizing`,
      evidence,
      nextAction: {
        command: "devdeck stop --agent",
        reason: "cleanup unstable service loop",
      },
    };
  }

  if ((service.status === "error" || service.status === "exited") && service.lastExitCode !== 0) {
    return {
      state: "degraded",
      root: "service_crash",
      service: service.name,
      confidence: 0.88,
      cause: `${service.name} exited after startup with non-zero code`,
      evidence,
      nextAction: {
        command: `devdeck service restart ${service.name} --agent --wait 30`,
        reason: "targeted recovery",
      },
    };
  }

  if (inferredRoot === "readiness_timeout" || service.readiness === "failed") {
    return {
      state: "degraded",
      root: "readiness_timeout",
      service: service.name,
      confidence: 0.84,
      cause: `${service.name} did not satisfy readiness before timeout`,
      evidence,
      nextAction: {
        command: "devdeck stop --agent",
        reason: "cleanup unresolved startup",
      },
    };
  }

  if (inferredRoot === "health_unreachable" || service.health === "unreachable" || service.health === "degraded") {
    return {
      state: service.health === "degraded" ? "warning" : "degraded",
      root: "health_unreachable",
      service: service.name,
      confidence: 0.8,
      cause: `${service.name} health checks are not passing`,
      evidence,
      nextAction: {
        command: `devdeck service restart ${service.name} --agent --wait 30`,
        reason: "recover unhealthy service",
      },
    };
  }

  return null;
}

function diagnoseWarning(snapshot: SessionSnapshot): AgentDiagnosis | null {
  const warningLog = [...snapshot.logs].reverse().find((log) => log.severity === "warning");
  if (!warningLog) {
    return null;
  }

  return {
    state: "warning",
    root: "warning_logs",
    service: warningLog.service,
    confidence: 0.78,
    cause: `${warningLog.service} is healthy but emitting warnings`,
    evidence: [{
      severity: "warning",
      service: warningLog.service,
      line: warningLog.line,
    }],
    nextAction: {
      command: `devdeck logs ${warningLog.service} --agent --severity warning --tail 40`,
      reason: "inspect bounded warning evidence",
    },
  };
}

function prioritizeServices(services: SessionSnapshot["services"]): SessionSnapshot["services"] {
  return [...services].sort((left, right) => severityRank(right) - severityRank(left));
}

function severityRank(service: ServiceSnapshot): number {
  if (service.status === "error") return 100;
  if (service.status === "exited") return 95;
  if (service.status === "blocked") return 90;
  if (service.readiness === "failed") return 85;
  if (service.health === "unreachable") return 80;
  if (service.health === "degraded") return 70;
  if (service.restartCount > 1) return 60;
  return 0;
}

function selectRelevantLogs(snapshot: SessionSnapshot, serviceName: string): LogSnapshot[] {
  return snapshot.logs
    .filter((log) => log.service === serviceName && (log.severity === "error" || log.severity === "warning"))
    .slice(-20);
}

function collectEvidence(service: ServiceSnapshot, logs: LogSnapshot[]): AgentDiagnosis["evidence"] {
  const entries = [
    ...(service.lastError ? [{
      severity: service.health === "degraded" ? "warning" as const : "error" as const,
      service: service.name,
      line: service.lastError,
    }] : []),
    ...logs.map((log) => ({
      severity: log.severity === "warning" ? "warning" as const : "error" as const,
      service: log.service,
      line: log.line,
    })),
  ];

  const seen = new Set<string>();
  return entries.filter((entry) => {
    const key = `${entry.severity}:${entry.service}:${entry.line}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  }).slice(0, 3);
}

function extractMissingEnvVariable(text: string): string | null {
  const match = text.match(/missing required env(?:ironment variable)?\s+([A-Z0-9_]+)/i);
  return match?.[1] ?? null;
}

function extractPort(text: string): string | null {
  const match = text.match(/(?:port|use on)\s+(\d{2,5})/i);
  return match?.[1] ?? null;
}
