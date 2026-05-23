import type { DashboardSnapshot } from "./session-client";

export function formatDebugContext(snapshot: DashboardSnapshot): string {
  const urls = [...new Set(snapshot.logs.flatMap((log) => log.urls))];
  const ports = [...new Set(snapshot.logs.flatMap((log) => log.ports))];

  return [
    `Project: ${snapshot.project}`,
    `Started: ${snapshot.startedAt}`,
    `Statuses: ${snapshot.services.map((service) => `${service.name}=${service.status}`).join(", ")}`,
    `Health: ${snapshot.services.map((service) => `${service.name}=${service.health}`).join(", ")}`,
    `Known URLs: ${urls.length > 0 ? urls.join(", ") : "none"}`,
    `Known Ports: ${ports.length > 0 ? ports.join(", ") : "none"}`,
  ].join("\n");
}
