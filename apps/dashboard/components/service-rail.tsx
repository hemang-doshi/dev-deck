import type { ReactNode } from "react";
import { AlertCircle, Play, RefreshCw, ServerCog, Square, Wifi, WifiOff } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { type DashboardService } from "../lib/session-client";

type ServiceRailProps = {
  services: DashboardService[];
  hasReceivedSnapshot: boolean;
  selectedService: string;
  onRestart: (serviceName: string) => Promise<void>;
  onSelectService: (serviceName: string) => void;
  onStart: (serviceName: string) => Promise<void>;
  onStop: (serviceName: string) => Promise<void>;
};

export function ServiceRail(props: ServiceRailProps) {
  return (
    <aside className="grid gap-4 xl:sticky xl:top-6">
      <Card className="rounded-[1.75rem] border-white/70 bg-white/72 shadow-[0_20px_50px_rgba(15,23,42,0.08)] backdrop-blur-xl">
        <CardContent className="grid gap-3 p-3">
          <div className="flex items-center justify-between gap-3 px-1">
            <div>
              <div className="text-sm font-semibold text-slate-950">Services</div>
              <div className="text-xs text-slate-500">Compact rail with selected-row actions</div>
            </div>
            <Badge variant="outline" className="rounded-full bg-white/80 px-2.5">
              {props.services.length}
            </Badge>
          </div>

          <button
            className={cn(
              "flex items-center justify-between rounded-2xl border px-3 py-2 text-left transition-all",
              props.selectedService === "all"
                ? "border-slate-900/10 bg-slate-950 text-white shadow-[0_16px_35px_rgba(15,23,42,0.18)]"
                : "border-white/70 bg-white/80 text-slate-900 hover:bg-white",
            )}
            onClick={() => props.onSelectService("all")}
            type="button"
          >
            <span className="text-sm font-medium">All services</span>
            <span className={cn("text-xs", props.selectedService === "all" ? "text-slate-200" : "text-slate-500")}>
              Unified
            </span>
          </button>

          {!props.hasReceivedSnapshot ? (
            <div className="grid gap-2">
              {Array.from({ length: 4 }, (_, index) => (
                <div key={index} className="rounded-2xl border border-white/70 bg-white/70 p-3">
                  <Skeleton className="h-4 w-24 rounded-full" />
                  <Skeleton className="mt-2 h-3 w-18 rounded-full" />
                </div>
              ))}
            </div>
          ) : null}

          {props.hasReceivedSnapshot && props.services.length === 0 ? (
            <Empty className="rounded-2xl border border-dashed border-slate-300/80 bg-white/70">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <ServerCog />
                </EmptyMedia>
                <EmptyTitle>No services yet</EmptyTitle>
                <EmptyDescription>The current session snapshot did not expose any managed services.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : null}

          {props.services.map((service) => {
            const active = props.selectedService === service.name;
            const unhealthy =
              service.health === "unreachable" || service.status === "error" || service.status === "exited";

            return (
              <div
                key={service.name}
                className={cn(
                  "rounded-2xl border px-3 py-2 text-left transition-all",
                  active
                    ? "border-slate-900/10 bg-white shadow-[0_16px_35px_rgba(15,23,42,0.12)]"
                    : "border-white/70 bg-white/70 hover:bg-white",
                )}
              >
                <button className="w-full text-left" onClick={() => props.onSelectService(service.name)} type="button">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium text-slate-950">{service.name}</span>
                        {service.group ? (
                          <Badge variant="outline" className="rounded-full bg-white/80 px-2 py-0 text-[10px]">
                            {service.group}
                          </Badge>
                        ) : null}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                        <span className="flex items-center gap-1">
                          {service.health === "healthy" ? <Wifi className="size-3" /> : <WifiOff className="size-3" />}
                          {service.health}
                        </span>
                        {service.port ? <span>:{service.port}</span> : null}
                        {service.restartCount > 0 ? <span>r{service.restartCount}</span> : null}
                      </div>
                    </div>
                    <Badge className={cn("rounded-full px-2.5", statusBadgeClass(service.status))}>
                      {service.status}
                    </Badge>
                  </div>
                </button>

                {active ? (
                  <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-200/70 pt-3">
                    <ActionButton label="Start" onClick={() => props.onStart(service.name)} icon={<Play className="size-3.5" />} />
                    <ActionButton label="Stop" onClick={() => props.onStop(service.name)} icon={<Square className="size-3.5" />} />
                    <ActionButton label="Restart" onClick={() => props.onRestart(service.name)} icon={<RefreshCw className="size-3.5" />} />
                    {service.lastError ? (
                      <span className="ml-auto max-w-[10rem] truncate text-[11px] text-amber-700">
                        {service.lastError}
                      </span>
                    ) : unhealthy ? (
                      <Badge variant="outline" className="ml-auto rounded-full border-amber-300 bg-amber-50 px-2.5 text-amber-700">
                        <AlertCircle className="size-3" />
                        Needs attention
                      </Badge>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </aside>
  );
}

function ActionButton({
  label,
  onClick,
  icon,
}: {
  label: string;
  onClick: () => Promise<void>;
  icon: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            aria-label={label}
            className="rounded-full bg-white/80 px-3"
            onClick={(event) => {
              event.stopPropagation();
              void onClick();
            }}
            size="sm"
            variant="outline"
          />
        }
      >
        {icon}
        {label}
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function statusBadgeClass(status: DashboardService["status"]) {
  if (status === "running") return "bg-emerald-500 text-white";
  if (status === "error" || status === "exited") return "bg-rose-500 text-white";
  if (status === "starting" || status === "stopping") return "bg-amber-500 text-white";
  return "bg-slate-500 text-white";
}
