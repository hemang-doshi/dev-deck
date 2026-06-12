import type { AgentNextAction, AgentSignal } from "./signal.js";

export function suggestNextActions(signal: AgentSignal): AgentNextAction[] {
  const actions: AgentNextAction[] = [];

  for (const issue of signal.issues) {
    if (issue.kind === "service_failed" && issue.service) {
      actions.push({
        command: `devdeck service restart ${issue.service}`,
        reason: "failed service",
      });
      continue;
    }

    if (issue.kind === "health_unreachable" && issue.service) {
      actions.push({
        command: `devdeck logs ${issue.service} --agent --severity error --tail 40`,
        reason: "inspect failing service",
      });
      continue;
    }

    if (issue.kind === "warning_logs" && issue.service) {
      actions.push({
        command: `devdeck logs ${issue.service} --agent --grep warning --tail 30`,
        reason: "inspect warning context",
      });
      continue;
    }

    if (issue.kind === "error_logs" && issue.service) {
      actions.push({
        command: `devdeck logs ${issue.service} --agent --severity error --tail 40`,
        reason: "inspect error context",
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
