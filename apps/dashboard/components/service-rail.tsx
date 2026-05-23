import type { DashboardService } from "../lib/session-client";

type ServiceRailProps = {
  services: DashboardService[];
  selectedService: string;
  onRestart: (serviceName: string) => Promise<void>;
  onSelectService: (serviceName: string) => void;
  onStart: (serviceName: string) => Promise<void>;
  onStop: (serviceName: string) => Promise<void>;
};

export function ServiceRail(props: ServiceRailProps) {
  return (
    <aside
      style={{
        display: "grid",
        gap: "0.75rem",
        alignContent: "start",
      }}
    >
      <button
        onClick={() => props.onSelectService("all")}
        style={cardStyle(props.selectedService === "all")}
      >
        <strong>All services</strong>
        <span style={{ color: "var(--muted)" }}>Unified session stream</span>
      </button>

      {props.services.map((service) => (
        <article key={service.name} style={cardStyle(props.selectedService === service.name)}>
          <button
            onClick={() => props.onSelectService(service.name)}
            style={{
              all: "unset",
              cursor: "pointer",
              display: "grid",
              gap: "0.25rem",
            }}
          >
            <strong>{service.name}</strong>
            <span style={{ color: statusColor(service.status) }}>{service.status}</span>
            <span style={{ color: "var(--muted)", fontSize: "0.9rem" }}>{service.command}</span>
            <span style={{ color: "var(--muted)", fontSize: "0.85rem" }}>
              health {service.health}
            </span>
          </button>

          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <button onClick={() => void props.onStart(service.name)} style={actionStyle}>
              Start
            </button>
            <button onClick={() => void props.onStop(service.name)} style={actionStyle}>
              Stop
            </button>
            <button onClick={() => void props.onRestart(service.name)} style={actionStyle}>
              Restart
            </button>
          </div>
        </article>
      ))}
    </aside>
  );
}

function cardStyle(active: boolean) {
  return {
    display: "grid",
    gap: "0.75rem",
    padding: "1rem",
    border: `1px solid ${active ? "rgba(17, 34, 24, 0.3)" : "var(--line)"}`,
    background: active ? "var(--surface-strong)" : "var(--surface)",
    boxShadow: active ? "var(--shadow)" : "none",
    textAlign: "left",
  } as const;
}

const actionStyle = {
  padding: "0.5rem 0.75rem",
  border: "1px solid var(--line)",
  background: "var(--surface-strong)",
  cursor: "pointer",
} as const;

function statusColor(status: DashboardService["status"]) {
  if (status === "running") return "var(--healthy)";
  if (status === "error" || status === "exited") return "var(--error)";
  if (status === "starting" || status === "stopping") return "var(--warning)";
  return "var(--muted)";
}
