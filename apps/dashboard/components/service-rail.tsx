import type { ReactNode } from "react";
import { AlertCircle, Play, RefreshCw, ServerCog, Square, Wifi, WifiOff } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Separator } from "@/components/ui/separator";
import { ShineBorder } from "@/components/ui/shine-border";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { type DashboardService } from "../lib/session-client";
import { cn } from "@/lib/utils";

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
    <aside className="grid gap-4">
      <button
        className={cn(
          "relative overflow-hidden rounded-3xl border p-4 text-left transition-all",
          props.selectedService === "all"
            ? "border-slate-900/10 bg-white/90 shadow-[0_18px_50px_rgba(15,23,42,0.12)]"
            : "border-white/70 bg-white/65 hover:bg-white/80",
        )}
        onClick={() => props.onSelectService("all")}
        type="button"
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-slate-950">All services</div>
            <div className="mt-1 text-sm text-slate-500">Unified session stream</div>
          </div>
          <Badge variant="outline" className="rounded-full bg-white/80 px-2.5">
            {props.services.length}
          </Badge>
        </div>
      </button>

      {!props.hasReceivedSnapshot ? (
        <div className="grid gap-3">
          {Array.from({ length: 3 }, (_, index) => (
            <Card key={index} className="rounded-3xl border-white/70 bg-white/65">
              <CardHeader>
                <Skeleton className="h-5 w-28 rounded-full" />
                <Skeleton className="h-4 w-full rounded-full" />
              </CardHeader>
              <CardContent className="space-y-2">
                <Skeleton className="h-4 w-24 rounded-full" />
                <Skeleton className="h-4 w-20 rounded-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}

      {props.hasReceivedSnapshot && props.services.length === 0 ? (
        <Card className="rounded-3xl border-dashed border-slate-300/80 bg-white/60">
          <CardContent className="p-0">
            <Empty className="border-0">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <ServerCog />
                </EmptyMedia>
                <EmptyTitle>No services yet</EmptyTitle>
                <EmptyDescription>The current session snapshot did not expose any managed services.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          </CardContent>
        </Card>
      ) : null}

      {props.services.map((service) => {
        const active = props.selectedService === service.name;
        const unhealthy = service.health === "unreachable" || service.status === "error" || service.status === "exited";

        return (
          <Card
            key={service.name}
            className={cn(
              "relative overflow-hidden rounded-3xl border-white/70 bg-white/72 backdrop-blur-xl transition-all",
              active && "border-slate-900/10 shadow-[0_18px_50px_rgba(15,23,42,0.14)]",
            )}
          >
            {active ? (
              <ShineBorder
                borderWidth={1.25}
                duration={16}
                shineColor={
                  unhealthy
                    ? ["rgba(251,191,36,0.18)", "rgba(248,113,113,0.2)"]
                    : ["rgba(34,197,94,0.16)", "rgba(59,130,246,0.16)"]
                }
              />
            ) : null}

            <CardHeader className="relative gap-3">
              <button
                className="space-y-2 text-left"
                onClick={() => props.onSelectService(service.name)}
                type="button"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle>{service.name}</CardTitle>
                    <CardDescription className="mt-1 break-all text-xs leading-5">
                      {service.command}
                    </CardDescription>
                  </div>
                  <Badge className={cn("rounded-full px-2.5", statusBadgeClass(service.status))}>
                    {service.status}
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className="rounded-full bg-white/75 px-2.5">
                    {service.health === "healthy" ? <Wifi className="size-3" /> : <WifiOff className="size-3" />}
                    {service.health}
                  </Badge>
                  {service.port ? (
                    <Badge variant="outline" className="rounded-full bg-white/75 px-2.5">
                      port {service.port}
                    </Badge>
                  ) : null}
                  {service.restartCount > 0 ? (
                    <Badge variant="outline" className="rounded-full bg-white/75 px-2.5">
                      restarts {service.restartCount}
                    </Badge>
                  ) : null}
                  {service.lastExitCode !== null ? (
                    <Badge variant="outline" className="rounded-full bg-white/75 px-2.5">
                      exit {service.lastExitCode}
                    </Badge>
                  ) : null}
                </div>
              </button>
            </CardHeader>

            <CardContent className="space-y-3 text-sm text-slate-600">
              <Separator className="bg-slate-200/80" />
              <div className="grid gap-2">
                <div className="flex items-center justify-between gap-3">
                  <span>PID</span>
                  <span className="font-medium text-slate-900">{service.pid ?? "Not running"}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>Last error</span>
                  <span className="max-w-[11rem] truncate font-medium text-slate-900">
                    {service.lastError ?? "None"}
                  </span>
                </div>
              </div>
            </CardContent>

            <CardFooter className="relative flex flex-wrap gap-2 border-t border-slate-200/70 bg-slate-50/70">
              <ActionButton label="Start" onClick={() => props.onStart(service.name)} icon={<Play className="size-3.5" />} />
              <ActionButton label="Stop" onClick={() => props.onStop(service.name)} icon={<Square className="size-3.5" />} />
              <ActionButton label="Restart" onClick={() => props.onRestart(service.name)} icon={<RefreshCw className="size-3.5" />} />
              {unhealthy ? (
                <Badge variant="outline" className="ml-auto rounded-full border-amber-300 bg-amber-50 px-2.5 text-amber-700">
                  <AlertCircle className="size-3" />
                  Needs attention
                </Badge>
              ) : null}
            </CardFooter>
          </Card>
        );
      })}
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
            onClick={() => void onClick()}
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
