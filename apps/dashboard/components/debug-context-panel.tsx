export function DebugContextPanel({ context }: { context: string }) {
  return (
    <section
      style={{
        border: "1px solid var(--line)",
        background: "var(--surface)",
        padding: "1rem",
      }}
    >
      <strong>Debug context</strong>
      <pre
        style={{
          margin: "0.75rem 0 0",
          whiteSpace: "pre-wrap",
          fontFamily: "\"SFMono-Regular\", Menlo, monospace",
          color: "var(--muted)",
        }}
      >
        {context}
      </pre>
    </section>
  );
}
