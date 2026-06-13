import type { AgentNextAction, AgentSignal } from "./signal.js";
import { detectRootCauseFromText } from "./diagnosis.js";

export function suggestNextActions(signal: AgentSignal): AgentNextAction[] {
  const actions: AgentNextAction[] = [];

  for (const issue of signal.issues) {
    const inferredRoot = detectRootCauseFromText(issue.message);

    if (
      issue.kind === "health_unreachable" ||
      issue.kind === "blocked" ||
      issue.kind === "error_logs" ||
      inferredRoot === "missing_env" ||
      inferredRoot === "port_conflict" ||
      inferredRoot === "readiness_timeout" ||
      inferredRoot === "health_unreachable"
    ) {
      actions.push({
        command: "devdeck diagnose --agent",
        reason: "identify root cause and recovery action",
      });
      continue;
    }

    if (issue.kind === "service_failed" && issue.service) {
      actions.push({
        command: `devdeck service restart ${issue.service} --agent --wait 30`,
        reason: "targeted recovery",
      });
      continue;
    }

    if (issue.kind === "warning_logs" && issue.service) {
      actions.push({
        command: `devdeck logs ${issue.service} --agent --severity warning --tail 40`,
        reason: "inspect bounded warning evidence",
      });
      continue;
    }
  }

  if (actions.length === 0) {
    actions.push({
      command: "none",
      reason: "no immediate action required",
    });
  }

  return dedupeActions(actions).slice(0, 3);
}

function dedupeActions(actions: AgentNextAction[]): AgentNextAction[] {
  const seen = new Set<string>();
  return actions.filter((action) => {
    if (seen.has(action.command)) {
      return false;
    }
    seen.add(action.command);
    return true;
  });
}
