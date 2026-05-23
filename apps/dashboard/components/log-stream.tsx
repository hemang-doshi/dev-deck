import { AlertTriangle, LoaderCircle, Radio } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { type DashboardLog, type DashboardService } from "../lib/session-client";

type LogStreamProps = {
  /** Optional accent ring inherited from tile color — ignored visually in terminal mode */
  color?: "slate" | "sky" | "mint" | "amber" | "rose";
  connectionState: "connecting" | "connected" | "reconnecting" | "disconnected";
  hasReceivedSnapshot: boolean;
  /** ScrollArea height class; defaults to h-[40rem] when not supplied */
  heightClass?: string;
  logs: DashboardLog[];
  reconnectAttempt: number;
  services: DashboardService[];
  /** Shown next to the STREAM label in the toolbar */
  subtitle?: string;
  /** Replaces "STREAM" label */
  title?: string;
};

export function LogStream(props: LogStreamProps) {
  const hasFailure = props.services.some(
    (service) => service.status === "error" || service.status === "exited",
  );

  return (
    <Card
      className={cn(
        "overflow-hidden rounded-[1.75rem] border border-slate-900/10 bg-[#09111a] text-slate-100 shadow-[0_24px_70px_rgba(15,23,42,0.28)]",
        colorRingClass(props.color ?? "slate"),
      )}
    >
      {/* ── Terminal toolbar ── */}
      <div className="flex items-center justify-between gap-3 border-b border-white/6 bg-[#0b1623] px-3 py-2">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-slate-400">
          {stateIcon(props.connectionState)}
          {props.title ?? "stream"}
          {props.subtitle ? (
            <span className="ml-1 normal-case tracking-normal text-slate-600">
              — {props.subtitle}
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <Badge
            className={cn(
              "rounded-full px-2 py-0 text-[10px]",
              streamStateClass(props.connectionState),
            )}
          >
            {props.connectionState}
          </Badge>
          <Badge
            variant="outline"
            className="rounded-full border-white/10 bg-white/5 px-2 py-0 text-[10px] text-slate-300"
          >
            {props.logs.length} lines
          </Badge>
        </div>
      </div>

      {/* ── Reconnecting banner ── */}
      {props.connectionState === "reconnecting" && props.logs.length > 0 ? (
        <div className="border-b border-amber-400/15 bg-amber-400/8 px-3 py-1.5 text-xs text-amber-100">
          Reconnecting to the local session stream. Existing logs are preserved
          {props.reconnectAttempt > 1 ? ` (${props.reconnectAttempt})` : ""}.
        </div>
      ) : null}

      {/* ── Loading skeletons ── */}
      {!props.hasReceivedSnapshot ? (
        <div className="grid gap-2 p-3">
          {Array.from({ length: 8 }, (_, index) => (
            <div key={index} className="rounded-md border border-white/6 bg-white/[0.03] p-2">
              <Skeleton className="h-3 w-28 bg-white/8" />
              <Skeleton className="mt-2 h-3 w-3/4 bg-white/8" />
            </div>
          ))}
        </div>
      ) : null}

      {/* ── Empty state ── */}
      {props.hasReceivedSnapshot && props.logs.length === 0 ? (
        <div className="flex flex-1 items-center justify-center px-6 py-16 text-center">
          <div className="max-w-sm space-y-2">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-300">
              {props.connectionState === "reconnecting" ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : hasFailure ? (
                <AlertTriangle className="size-4" />
              ) : (
                <Radio className="size-4" />
              )}
            </div>
            <div className="text-sm font-medium text-slate-100">
              {props.connectionState === "reconnecting"
                ? "Reconnecting to local session"
                : hasFailure
                  ? "Waiting on failed services"
                  : "No logs yet"}
            </div>
            <div className="text-xs leading-5 text-slate-400">
              {props.connectionState === "reconnecting"
                ? "The terminal surface will resume when the local session stream is back."
                : hasFailure
                  ? "One or more services exited before producing healthy output."
                  : "Services are running but nothing has been emitted yet."}
            </div>
          </div>
        </div>
      ) : null}

      {/* ── Log entries — terminal style ── */}
      {props.logs.length > 0 ? (
        <ScrollArea className={props.heightClass ?? "h-[40rem]"}>
          <div className="space-y-1 px-3 py-2 font-mono text-[12px] leading-5 text-slate-100">
            {props.logs.map((log, index) => {
              const previous = props.logs[index - 1];
              const stackTraceGroup =
                log.isStackTrace && previous && previous.service === log.service;

              return (
                <article
                  key={`${log.timestamp}-${log.id}`}
                  className={cn(
                    "rounded-md border border-transparent px-2 py-1.5",
                    stackTraceGroup
                      ? "ml-6 border-l border-l-white/8 pl-3"
                      : "bg-white/[0.015]",
                    logLineToneClass(log.severity),
                  )}
                >
                  {/* Metadata row: timestamp · service pill · severity · stream */}
                  <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-slate-500">
                    <span className="min-w-14 text-slate-300">
                      {timestampLabel(log.timestamp)}
                    </span>
                    <span className="rounded-full border border-white/8 bg-white/4 px-1.5 py-0.5 text-slate-300">
                      {log.service}
                    </span>
                    <span>{log.severity}</span>
                    <span>{log.stream}</span>
                  </div>
                  {/* Log line */}
                  <pre className="mt-1 whitespace-pre-wrap break-words text-[12px] leading-5 text-slate-100">
                    {log.line}
                  </pre>
                </article>
              );
            })}
          </div>
        </ScrollArea>
      ) : null}
    </Card>
  );
}

function stateIcon(state: LogStreamProps["connectionState"]) {
  if (state === "connected") return <Radio className="size-3 text-emerald-300" />;
  if (state === "reconnecting")
    return <LoaderCircle className="size-3 animate-spin text-amber-200" />;
  if (state === "disconnected") return <AlertTriangle className="size-3 text-rose-200" />;
  return <LoaderCircle className="size-3 animate-spin text-sky-200" />;
}

function streamStateClass(state: LogStreamProps["connectionState"]) {
  if (state === "connected") return "border-emerald-400/20 bg-emerald-400/12 text-emerald-100";
  if (state === "reconnecting") return "border-amber-400/20 bg-amber-400/12 text-amber-100";
  if (state === "disconnected") return "border-rose-400/20 bg-rose-400/12 text-rose-100";
  return "border-sky-400/20 bg-sky-400/12 text-sky-100";
}

function logLineToneClass(severity: DashboardLog["severity"]) {
  if (severity === "error") return "border-l-2 border-l-rose-400/70";
  if (severity === "warning") return "border-l-2 border-l-amber-300/70";
  return "border-l-2 border-l-cyan-300/30";
}

function colorRingClass(color: NonNullable<LogStreamProps["color"]>) {
  if (color === "sky") return "ring-1 ring-sky-300/25";
  if (color === "mint") return "ring-1 ring-emerald-300/25";
  if (color === "amber") return "ring-1 ring-amber-300/25";
  if (color === "rose") return "ring-1 ring-rose-300/25";
  return "ring-1 ring-slate-300/10";
}

function timestampLabel(timestamp: string) {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}
