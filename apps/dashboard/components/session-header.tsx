type SessionHeaderProps = {
  project: string;
  serviceCount: number;
  connectionState: "connecting" | "connected" | "disconnected";
  feedback: string | null;
  onExport: () => Promise<void>;
  onStopSession: () => Promise<void>;
};

export function SessionHeader(props: SessionHeaderProps) {
  return (
    <header
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: "1rem",
        padding: "1.5rem",
        border: "1px solid var(--line)",
        background: "var(--surface)",
        boxShadow: "var(--shadow)",
      }}
    >
      <div>
        <p style={{ margin: 0, color: "var(--muted)", fontSize: "0.85rem" }}>Current session</p>
        <h1 style={{ margin: "0.2rem 0", fontSize: "2.25rem" }}>{props.project || "DevDeck"}</h1>
        <p style={{ margin: 0, color: "var(--muted)" }}>
          {props.serviceCount} services • connection {props.connectionState}
        </p>
        {props.feedback ? <p style={{ margin: "0.35rem 0 0" }}>{props.feedback}</p> : null}
      </div>

      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", justifyContent: "end" }}>
        <button onClick={() => void props.onExport()} style={buttonStyle("var(--surface-strong)")}>
          Export session
        </button>
        <button onClick={() => void props.onStopSession()} style={buttonStyle("#142013", "#fff8f2")}>
          Stop session
        </button>
      </div>
    </header>
  );
}

function buttonStyle(background: string, color: string = "var(--ink)") {
  return {
    background,
    color,
    border: "1px solid var(--line)",
    padding: "0.75rem 1rem",
    cursor: "pointer",
  } as const;
}
