"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

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

const defaultSessionClient = createBrowserSessionClient();

export function DashboardShell({ client }: { client?: BrowserSessionClient }) {
  const [selectedService, setSelectedService] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [severity, setSeverity] = useState<SeverityFilter>("all");
  const deferredSearch = useDeferredValue(search);
  const sessionClient = client ?? defaultSessionClient;
  const {
    connectionState,
    feedback,
    hasReceivedSnapshot,
    lastConnectedAt,
    performAction,
    reconnectAttempt,
    snapshot,
    exportSession,
    copyText,
  } = useSessionClient(sessionClient);
  const summary = useMemo(() => {
    const runningCount = snapshot.services.filter((service) => service.status === "running").length;
    const healthyCount = snapshot.services.filter((service) => service.health === "healthy").length;
    const errorCount = snapshot.services.filter(
      (service) => service.status === "error" || service.status === "exited" || service.health === "unreachable",
    ).length;

    return { runningCount, healthyCount, errorCount };
  }, [snapshot.services]);

  useEffect(() => {
    if (!feedback) {
      return;
    }

    toast(feedback);
  }, [feedback]);

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
        padding: "1.25rem",
      }}
      className="relative isolate min-h-screen overflow-hidden md:p-6"
    >
      <div className="pointer-events-none absolute inset-0 -z-20 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.95),transparent_28%),radial-gradient(circle_at_80%_12%,rgba(125,211,252,0.2),transparent_22%),linear-gradient(180deg,#f8fbff_0%,#eef4ff_45%,#edf8f4_100%)]" />
      <div className="pointer-events-none absolute inset-0 -z-10 opacity-70">
        <div className="absolute inset-x-6 top-4 h-64 rounded-full bg-[radial-gradient(circle,rgba(125,211,252,0.16),transparent_60%)] blur-3xl" />
      </div>

      <div className="mx-auto grid max-w-[1600px] gap-6">
      <SessionHeader
        feedback={feedback}
        project={snapshot.project}
        serviceCount={snapshot.services.length}
        runningCount={summary.runningCount}
        healthyCount={summary.healthyCount}
        errorCount={summary.errorCount}
        connectionState={connectionState}
        lastConnectedAt={lastConnectedAt}
        onExport={exportSession}
        onStopSession={() => performAction("stop-session")}
      />

      <section className="grid items-start gap-6 xl:grid-cols-[minmax(18rem,24rem)_minmax(0,1fr)_minmax(20rem,24rem)]">
        <ServiceRail
          hasReceivedSnapshot={hasReceivedSnapshot}
          selectedService={selectedService}
          services={snapshot.services}
          onRestart={(serviceName) => performAction("restart", serviceName)}
          onSelectService={setSelectedService}
          onStart={(serviceName) => performAction("start", serviceName)}
          onStop={(serviceName) => performAction("stop", serviceName)}
        />

        <div className="grid gap-4 xl:min-w-0">
          <LogToolbar
            selectedService={selectedService}
            services={snapshot.services}
            search={search}
            severity={severity}
            visibleLogCount={filteredLogs.length}
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
            hasReceivedSnapshot={hasReceivedSnapshot}
            reconnectAttempt={reconnectAttempt}
            logs={filteredLogs}
            services={snapshot.services}
          />

          <DebugContextPanel
            context={debugContext}
            onCopy={() => copyText(debugContext, "Debug context copied")}
          />
        </div>

        <DebugContextPanel
          context={debugContext}
          onCopy={() => copyText(debugContext, "Debug context copied")}
        />
      </section>
      </div>
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
