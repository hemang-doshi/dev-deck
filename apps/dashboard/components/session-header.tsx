import type { ReactNode } from "react";
import {
  Activity,
  Download,
  PlugZap,
  SquareTerminal,
  StopCircle,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ShineBorder } from "@/components/ui/shine-border";
import { ShimmerButton } from "@/components/ui/shimmer-button";
import { cn } from "@/lib/utils";

type SessionHeaderProps = {
  project: string;
  serviceCount: number;
  runningCount: number;
  healthyCount: number;
  errorCount: number;
  connectionState: "connecting" | "connected" | "reconnecting" | "disconnected";
  lastConnectedAt: string | null;
  feedback: string | null;
  onExport: () => Promise<void>;
  onStopSession: () => Promise<void>;
};

export function SessionHeader(props: SessionHeaderProps) {
  return (
    <Card className="relative overflow-hidden border-white/50 bg-white/72 shadow-[0_24px_80px_rgba(15,23,42,0.12)] backdrop-blur-xl">
      <ShineBorder
        borderWidth={1.5}
        duration={18}
        shineColor={["rgba(34,197,94,0.15)", "rgba(59,130,246,0.18)", "rgba(168,85,247,0.16)"]}
      />
      <CardContent className="relative flex flex-col gap-5 p-5 md:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.18em] text-slate-500">
              <SquareTerminal className="size-3.5" />
              Current session
            </div>

            <div className="space-y-2">
              <h1 className="text-3xl font-semibold tracking-tight text-slate-950 md:text-4xl">
                {props.project || "DevDeck"}
              </h1>
              <div className="flex flex-wrap items-center gap-2">
                <Badge className={cn("gap-1.5 rounded-full px-2.5", connectionBadgeClass(props.connectionState))}>
                  <PlugZap className="size-3" />
                  {connectionLabel(props.connectionState)}
                </Badge>
                <Badge variant="outline" className="rounded-full border-slate-300/70 bg-white/70 px-2.5 text-slate-700">
                  {props.serviceCount} services
                </Badge>
                {props.feedback ? (
                  <Badge variant="outline" className="rounded-full border-emerald-200 bg-emerald-50/80 px-2.5 text-emerald-700">
                    {props.feedback}
                  </Badge>
                ) : null}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <ShimmerButton
              aria-label="Export session"
              className="h-9 px-4 text-sm font-medium text-white"
              onClick={() => void props.onExport()}
              background="rgba(15,23,42,0.96)"
              shimmerColor="#dbeafe"
            >
              <Download className="size-4" />
              Export session
            </ShimmerButton>
            <Button
              aria-label="Stop session"
              className="h-9 rounded-full px-4"
              variant="destructive"
              onClick={() => void props.onStopSession()}
            >
              <StopCircle className="size-4" />
              Stop session
            </Button>
          </div>
        </div>

        <Separator className="bg-slate-200/80" />

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricPill label="Running" value={props.runningCount} tone="emerald" />
          <MetricPill label="Healthy" value={props.healthyCount} tone="sky" />
          <MetricPill label="Attention" value={props.errorCount} tone="amber" />
          <MetricPill
            label="Last connected"
            value={props.lastConnectedAt ? new Date(props.lastConnectedAt).toLocaleTimeString() : "Waiting"}
            tone="slate"
            icon={<Activity className="size-3.5" />}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function MetricPill({
  label,
  value,
  tone,
  icon,
}: {
  label: string;
  value: number | string;
  tone: "emerald" | "sky" | "amber" | "slate";
  icon?: ReactNode;
}) {
  return (
    <div className={cn("rounded-2xl border px-4 py-3", metricToneClass(tone))}>
      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-slate-500">
        {icon}
        {label}
      </div>
      <div className="mt-1 text-lg font-semibold text-slate-950">{value}</div>
    </div>
  );
}

function connectionLabel(state: SessionHeaderProps["connectionState"]) {
  if (state === "connected") return "Connected";
  if (state === "reconnecting") return "Reconnecting";
  if (state === "disconnected") return "Disconnected";
  return "Connecting";
}

function connectionBadgeClass(state: SessionHeaderProps["connectionState"]) {
  if (state === "connected") return "bg-emerald-500 text-white";
  if (state === "reconnecting") return "bg-amber-500 text-white";
  if (state === "disconnected") return "bg-rose-500 text-white";
  return "bg-sky-500 text-white";
}

function metricToneClass(tone: "emerald" | "sky" | "amber" | "slate") {
  if (tone === "emerald") return "border-emerald-200/80 bg-emerald-50/70";
  if (tone === "sky") return "border-sky-200/80 bg-sky-50/70";
  if (tone === "amber") return "border-amber-200/80 bg-amber-50/70";
  return "border-slate-200/80 bg-slate-50/70";
}
