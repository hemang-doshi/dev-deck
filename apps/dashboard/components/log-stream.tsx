import type { DashboardLog, DashboardService } from "../lib/session-client";

type LogStreamProps = {
  connectionState: "connecting" | "connected" | "disconnected";
  logs: DashboardLog[];
  services: DashboardService[];
};

export function LogStream(props: LogStreamProps) {
  const hasFailure = props.services.some(
    (service) => service.status === "error" || service.status === "exited",
  );

  return (
    <section
      style={{
        border: "1px solid var(--line)",
        background: "var(--surface)",
        minHeight: "24rem",
        display: "grid",
      }}
    >
      <header
        style={{
          padding: "1rem",
          borderBottom: "1px solid var(--line)",
          display: "flex",
          justifyContent: "space-between",
        }}
      >
        <strong>Live log stream</strong>
        <span style={{ color: "var(--muted)" }}>{props.connectionState}</span>
      </header>

      {props.connectionState === "disconnected" ? (
        <StateCopy title="Reconnecting" body="The dashboard lost the local session stream and is trying again." />
      ) : null}
      {props.connectionState !== "disconnected" && props.logs.length === 0 ? (
        <StateCopy
          title={hasFailure ? "Partial failure" : "No logs yet"}
          body={
            hasFailure
              ? "Some services failed before producing healthy output. Use restart on the affected service card."
              : "Services are up, but nothing has been emitted yet."
          }
        />
      ) : null}

      {props.logs.length > 0 ? (
        <div
          style={{
            display: "grid",
            gap: "0.35rem",
            padding: "1rem",
            maxHeight: "32rem",
            overflow: "auto",
            alignContent: "start",
          }}
        >
          {props.logs.map((log) => (
            <article
              key={`${log.timestamp}-${log.id}`}
              style={{
                padding: "0.75rem",
                borderLeft: `4px solid ${severityColor(log.severity)}`,
                background: "var(--surface-strong)",
              }}
            >
              <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", color: "var(--muted)" }}>
                <span>{log.service}</span>
                <span>{log.severity}</span>
                <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
              </div>
              <pre
                style={{
                  margin: "0.45rem 0 0",
                  whiteSpace: "pre-wrap",
                  fontFamily: "\"SFMono-Regular\", Menlo, monospace",
                }}
              >
                {log.line}
              </pre>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function StateCopy({ title, body }: { title: string; body: string }) {
  return (
    <div style={{ padding: "2rem 1rem" }}>
      <strong>{title}</strong>
      <p style={{ margin: "0.5rem 0 0", color: "var(--muted)" }}>{body}</p>
    </div>
  );
}

function severityColor(severity: DashboardLog["severity"]) {
  if (severity === "error") return "var(--error)";
  if (severity === "warning") return "var(--warning)";
  return "var(--healthy)";
}
