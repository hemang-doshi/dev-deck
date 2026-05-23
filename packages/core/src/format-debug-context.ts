import type { SessionSnapshot } from "./service-session.js";

export function formatDebugContext(snapshot: SessionSnapshot): string {
  const urls = [...new Set(snapshot.logs.flatMap((log) => log.urls))];
  const ports = [...new Set(snapshot.logs.flatMap((log) => log.ports))];
  const erroredServices = snapshot.services
    .filter((service) => service.status === "error" || service.status === "exited")
    .map((service) => `${service.name}:${service.status}`);

  return [
    `Project: ${snapshot.project}`,
    `Started: ${snapshot.startedAt}`,
    `Services: ${snapshot.services.length}`,
    `Statuses: ${snapshot.services.map((service) => `${service.name}=${service.status}`).join(", ")}`,
    `Health: ${snapshot.services
      .map((service) => `${service.name}=${service.health}`)
      .join(", ")}`,
    `Known URLs: ${urls.length > 0 ? urls.join(", ") : "none"}`,
    `Known Ports: ${ports.length > 0 ? ports.join(", ") : "none"}`,
    `Errors: ${erroredServices.length > 0 ? erroredServices.join(", ") : "none"}`,
  ].join("\n");
}
