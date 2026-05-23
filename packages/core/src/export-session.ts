import { formatDebugContext } from "./format-debug-context.js";
import type { SessionSnapshot } from "./service-session.js";

export function exportSession(snapshot: SessionSnapshot): string {
  const logs = snapshot.logs
    .map(
      (log) =>
        `${log.timestamp} [${log.service}] ${log.severity.toUpperCase()} ${log.stream}: ${log.line}`,
    )
    .join("\n");

  return [
    "# DevDeck Session Export",
    "",
    "## Debug Context",
    formatDebugContext(snapshot),
    "",
    "## Logs",
    logs,
    "",
  ].join("\n");
}
