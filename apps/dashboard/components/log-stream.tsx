import { AlertTriangle, LoaderCircle, Radio, TerminalSquare } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { type DashboardLog, type DashboardService } from "../lib/session-client";
import { cn } from "@/lib/utils";

type LogStreamProps = {
  color?: "slate" | "sky" | "mint" | "amber" | "rose";
  connectionState: "connecting" | "connected" | "reconnecting" | "disconnected";
  hasReceivedSnapshot: boolean;
  heightClass?: string;
  logs: DashboardLog[];
  reconnectAttempt: number;
  services: DashboardService[];
  subtitle?: string;
  title?: string;
};

export function LogStream(props: LogStreamProps) {
  const hasFailure = props.services.some(
    (service) => service.status === "error" || service.status === "exited",
  );

  return (
    <Card
      className={cn(
        "overflow-hidden rounded-[1.75rem] border border-slate-900/10 bg-[#0f172a] text-slate-100 shadow-[0_24px_70px_rgba(15,23,42,0.28)]",
        colorToneClass(props.color ?? "slate"),
      )}
    >
      <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-slate-950/85 px-4 py-3 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <TerminalSquare className="size-4 text-cyan-300" />
          <div>
            <strong className="font-medium">{props.title ?? "Live log stream"}</strong>
            {props.subtitle ? <div className="text-xs text-slate-400">{props.subtitle}</div> : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge className={cn("rounded-full px-2.5", streamStateClass(props.connectionState))}>
            {stateIcon(props.connectionState)}
            {props.connectionState}
          </Badge>
          <Badge className="rounded-full bg-white/10 px-2.5 text-slate-200">
            {props.logs.length} lines
          </Badge>
        </div>
      </div>

      {props.connectionState === "reconnecting" && props.logs.length > 0 ? (
        <div className="border-b border-amber-300/20 bg-amber-400/10 px-4 py-2 text-sm text-amber-100">
          Reconnecting to the local session stream. Existing logs are preserved{props.reconnectAttempt > 1 ? ` (${props.reconnectAttempt})` : ""}.
        </div>
      ) : null}

      {!props.hasReceivedSnapshot ? (
        <div className="grid gap-3 p-4">
          {Array.from({ length: 5 }, (_, index) => (
            <div key={index} className="rounded-2xl border border-white/8 bg-white/4 p-4">
              <div className="flex gap-2">
                <Skeleton className="h-4 w-20 bg-white/10" />
                <Skeleton className="h-4 w-16 bg-white/10" />
              </div>
              <Skeleton className="mt-3 h-4 w-3/4 bg-white/10" />
            </div>
          ))}
        </div>
      ) : null}

      {props.hasReceivedSnapshot && props.logs.length === 0 ? (
        <Empty className="min-h-[26rem] border-0 text-slate-100">
          <EmptyHeader>
            <EmptyMedia variant="icon" className="bg-white/10 text-cyan-200">
              {props.connectionState === "reconnecting" ? <LoaderCircle className="animate-spin" /> : hasFailure ? <AlertTriangle /> : <Radio />}
            </EmptyMedia>
            <EmptyTitle className="text-slate-100">
              {props.connectionState === "reconnecting"
                ? "Reconnecting"
                : hasFailure
                  ? "Partial failure"
                  : "No logs yet"}
            </EmptyTitle>
            <EmptyDescription className="text-slate-400">
              {props.connectionState === "reconnecting"
                ? "The dashboard lost the local session stream and is trying again."
                : hasFailure
                  ? "Some services failed before producing healthy output. Use restart on the affected service card."
                  : "Services are up, but nothing has been emitted yet."}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : null}

      {props.logs.length > 0 ? (
        <ScrollArea className={props.heightClass ?? "h-[40rem]"}>
          <div className="grid gap-2 p-4">
            {props.logs.map((log) => (
              <article
                key={`${log.timestamp}-${log.id}`}
                className={cn(
                  "rounded-2xl border px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
                  logToneClass(log.severity),
                )}
              >
                <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.14em] text-slate-400">
                  <span>{log.service}</span>
                  <span>{log.severity}</span>
                  <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
                </div>
                <pre className="mt-2 whitespace-pre-wrap break-words font-mono text-[13px] leading-6 text-slate-100">
                  {log.line}
                </pre>
              </article>
            ))}
          </div>
        </ScrollArea>
      ) : null}
    </Card>
  );
}

function stateIcon(state: LogStreamProps["connectionState"]) {
  if (state === "connected") return <Radio className="size-3" />;
  if (state === "reconnecting") return <LoaderCircle className="size-3 animate-spin" />;
  if (state === "disconnected") return <AlertTriangle className="size-3" />;
  return <LoaderCircle className="size-3 animate-spin" />;
}

function streamStateClass(state: LogStreamProps["connectionState"]) {
  if (state === "connected") return "bg-emerald-500 text-white";
  if (state === "reconnecting") return "bg-amber-500 text-white";
  if (state === "disconnected") return "bg-rose-500 text-white";
  return "bg-sky-500 text-white";
}

function logToneClass(severity: DashboardLog["severity"]) {
  if (severity === "error") return "border-rose-400/25 bg-rose-400/10";
  if (severity === "warning") return "border-amber-300/20 bg-amber-300/10";
  return "border-cyan-300/12 bg-slate-900/90";
}

function colorToneClass(color: NonNullable<LogStreamProps["color"]>) {
  if (color === "sky") return "ring-1 ring-sky-300/25";
  if (color === "mint") return "ring-1 ring-emerald-300/25";
  if (color === "amber") return "ring-1 ring-amber-300/25";
  if (color === "rose") return "ring-1 ring-rose-300/25";
  return "ring-1 ring-slate-300/20";
}
