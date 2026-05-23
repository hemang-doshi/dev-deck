"use client";

import { useDeferredValue, useState } from "react";

import { DebugContextPanel } from "./debug-context-panel";
import { LogStream } from "./log-stream";
import { LogToolbar } from "./log-toolbar";
import { ServiceRail } from "./service-rail";
import { SessionHeader } from "./session-header";
import { formatDebugContext } from "../lib/format-debug-context";
import {
  type BrowserSessionClient,
  type DashboardLog,
  type SeverityFilter,
  createBrowserSessionClient,
  useSessionClient,
} from "../lib/session-client";

export function DashboardShell({ client }: { client?: BrowserSessionClient }) {
  const [selectedService, setSelectedService] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [severity, setSeverity] = useState<SeverityFilter>("all");
  const deferredSearch = useDeferredValue(search);
  const sessionClient = client ?? createBrowserSessionClient();
  const { connectionState, feedback, performAction, snapshot, exportSession, copyText } =
    useSessionClient(sessionClient);

  const filteredLogs = filterLogs(
    snapshot.logs,
    selectedService,
    deferredSearch,
    severity,
  );
  const debugContext = formatDebugContext(snapshot);

  return (
    <main
      style={{
        padding: "2rem",
        display: "grid",
        gap: "1.5rem",
      }}
    >
      <SessionHeader
        feedback={feedback}
        project={snapshot.project}
        serviceCount={snapshot.services.length}
        connectionState={connectionState}
        onExport={exportSession}
        onStopSession={() => performAction("stop-session")}
      />

      <section
        style={{
          display: "grid",
          gap: "1.5rem",
          gridTemplateColumns: "minmax(18rem, 22rem) minmax(0, 1fr)",
          alignItems: "start",
        }}
      >
        <ServiceRail
          selectedService={selectedService}
          services={snapshot.services}
          onRestart={(serviceName) => performAction("restart", serviceName)}
          onSelectService={setSelectedService}
          onStart={(serviceName) => performAction("start", serviceName)}
          onStop={(serviceName) => performAction("stop", serviceName)}
        />

        <div style={{ display: "grid", gap: "1rem" }}>
          <LogToolbar
            selectedService={selectedService}
            services={snapshot.services}
            search={search}
            severity={severity}
            onCopyDebug={() => copyText(debugContext, "Debug context copied")}
            onCopyLogs={() =>
              copyText(
                filteredLogs
                  .map((log) => `[${log.service}] ${log.severity.toUpperCase()} ${log.line}`)
                  .join("\n"),
                "Visible logs copied",
              )
            }
            onSearchChange={setSearch}
            onSelectService={setSelectedService}
            onSeverityChange={setSeverity}
          />

          <LogStream
            connectionState={connectionState}
            logs={filteredLogs}
            services={snapshot.services}
          />

          <DebugContextPanel context={debugContext} />
        </div>
      </section>
    </main>
  );
}

function filterLogs(
  logs: DashboardLog[],
  selectedService: string,
  search: string,
  severity: SeverityFilter,
): DashboardLog[] {
  const loweredSearch = search.trim().toLowerCase();

  return logs.filter((log) => {
    if (selectedService !== "all" && log.service !== selectedService) {
      return false;
    }

    if (severity !== "all" && log.severity !== severity) {
      return false;
    }

    if (loweredSearch !== "" && !log.line.toLowerCase().includes(loweredSearch)) {
      return false;
    }

    return true;
  });
}
