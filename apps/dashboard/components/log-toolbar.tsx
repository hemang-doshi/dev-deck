import type { DashboardService, SeverityFilter } from "../lib/session-client";

type LogToolbarProps = {
  search: string;
  selectedService: string;
  severity: SeverityFilter;
  services: DashboardService[];
  onCopyDebug: () => Promise<void>;
  onCopyLogs: () => Promise<void>;
  onSearchChange: (value: string) => void;
  onSelectService: (serviceName: string) => void;
  onSeverityChange: (severity: SeverityFilter) => void;
};

export function LogToolbar(props: LogToolbarProps) {
  return (
    <section
      style={{
        display: "grid",
        gap: "0.75rem",
        padding: "1rem",
        border: "1px solid var(--line)",
        background: "var(--surface)",
      }}
    >
      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
        <input
          aria-label="Search logs"
          onChange={(event) => props.onSearchChange(event.target.value)}
          placeholder="Search current session logs"
          value={props.search}
          style={controlStyle}
        />
        <select
          aria-label="Filter service"
          onChange={(event) => props.onSelectService(event.target.value)}
          value={props.selectedService}
          style={controlStyle}
        >
          <option value="all">All services</option>
          {props.services.map((service) => (
            <option key={service.name} value={service.name}>
              {service.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter severity"
          onChange={(event) => props.onSeverityChange(event.target.value as SeverityFilter)}
          value={props.severity}
          style={controlStyle}
        >
          <option value="all">All severities</option>
          <option value="info">Info</option>
          <option value="warning">Warnings</option>
          <option value="error">Errors</option>
        </select>
      </div>

      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
        <button onClick={() => void props.onCopyLogs()} style={buttonStyle}>
          Copy visible logs
        </button>
        <button onClick={() => void props.onCopyDebug()} style={buttonStyle}>
          Copy debug context
        </button>
      </div>
    </section>
  );
}

const controlStyle = {
  minWidth: "12rem",
  padding: "0.7rem 0.85rem",
  border: "1px solid var(--line)",
  background: "var(--surface-strong)",
} as const;

const buttonStyle = {
  padding: "0.65rem 0.85rem",
  border: "1px solid var(--line)",
  background: "var(--surface-strong)",
  cursor: "pointer",
} as const;
