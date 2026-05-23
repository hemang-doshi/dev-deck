import { Copy, Filter, Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { type DashboardService, type SeverityFilter } from "../lib/session-client";

type LogToolbarProps = {
  search: string;
  selectedService: string;
  severity: SeverityFilter;
  services: DashboardService[];
  visibleLogCount: number;
  onCopyLogs: () => Promise<void>;
  onSearchChange: (value: string) => void;
  onSelectService: (serviceName: string) => void;
  onSeverityChange: (severity: SeverityFilter) => void;
};

export function LogToolbar(props: LogToolbarProps) {
  return (
    <Card className="rounded-3xl border-white/70 bg-white/72 shadow-[0_20px_50px_rgba(15,23,42,0.08)] backdrop-blur-xl">
      <CardContent className="flex flex-col gap-4 p-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
            <Input
              aria-label="Search logs"
              className="h-10 rounded-full border-slate-200 bg-white/90 pl-9"
              onChange={(event) => props.onSearchChange(event.target.value)}
              placeholder="Search current session logs"
              value={props.search}
            />
          </div>

          <Select
            onValueChange={(value) => {
              if (value) props.onSelectService(value);
            }}
            value={props.selectedService}
          >
            <SelectTrigger aria-label="Filter service" className="h-10 w-full rounded-full border-slate-200 bg-white/90 xl:w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All services</SelectItem>
              {props.services.map((service) => (
                <SelectItem key={service.name} value={service.name}>
                  {service.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Filter className="size-4" />
              Active filters
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="rounded-full bg-white/80 px-2.5">
                {props.selectedService === "all" ? "All services" : props.selectedService}
              </Badge>
              <Badge variant="outline" className="rounded-full bg-white/80 px-2.5">
                {props.severity === "all" ? "All severities" : props.severity}
              </Badge>
              <Badge variant="outline" className="rounded-full bg-white/80 px-2.5">
                {props.visibleLogCount} visible
              </Badge>
              <Badge variant="outline" className="rounded-full bg-white/80 px-2.5">
                Unified tile only
              </Badge>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <ToggleGroup
              aria-label="Filter severity"
              multiple={false}
              onValueChange={(value) => {
                props.onSeverityChange((value[0] ?? "all") as SeverityFilter);
              }}
              value={[props.severity]}
            >
              <ToggleGroupItem value="all">All</ToggleGroupItem>
              <ToggleGroupItem value="info">Info</ToggleGroupItem>
              <ToggleGroupItem value="warning">Warn</ToggleGroupItem>
              <ToggleGroupItem value="error">Error</ToggleGroupItem>
            </ToggleGroup>
            <Button className="rounded-full bg-white/85" onClick={() => void props.onCopyLogs()} size="sm" variant="outline">
              <Copy className="size-3.5" />
              Copy visible logs
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
