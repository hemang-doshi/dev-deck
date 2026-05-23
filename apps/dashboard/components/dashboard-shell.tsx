"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { ArrowLeft, GripVertical, LayoutGrid, PaintBucket, Plus, Rows3, X } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "motion/react";
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
import {
  addWorkspaceTile,
  createDefaultWorkspace,
  cycleTileColor,
  cycleTileSize,
  filterLogsForTile,
  getTileServices,
  getTileSubtitle,
  getTileTitle,
  getWorkspaceStorageKey,
  listServiceGroups,
  removeWorkspaceTile,
  reorderWorkspaceTiles,
  sanitizeWorkspaceState,
  sortAndReindexTiles,
  type WorkspaceTile,
  type WorkspaceState,
} from "../lib/workspace-state";

const defaultSessionClient = createBrowserSessionClient();

export function DashboardShell({ client }: { client?: BrowserSessionClient }) {
  const [selectedService, setSelectedService] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [severity, setSeverity] = useState<SeverityFilter>("all");
  const [draggedTileId, setDraggedTileId] = useState<string | null>(null);
  const [hydratedProject, setHydratedProject] = useState<string | null>(null);
  const [workspace, setWorkspace] = useState<WorkspaceState>(createDefaultWorkspace());
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);

  // Click away and Escape key listeners for Add Tile menu
  useEffect(() => {
    if (!isAddMenuOpen) return;

    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const menuContainer = document.getElementById("add-tile-menu-container");
      const toggleButton = document.getElementById("add-tile-toggle-button");
      if (
        menuContainer &&
        !menuContainer.contains(target) &&
        toggleButton &&
        !toggleButton.contains(target)
      ) {
        setIsAddMenuOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsAddMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isAddMenuOpen]);

  const isUnifiedAdded = workspace.tiles.some((tile) => tile.id === "unified");
  const isGroupAdded = (groupName: string) => workspace.tiles.some((tile) => tile.id === `group:${groupName}`);
  const isServiceAdded = (serviceName: string) => workspace.tiles.some((tile) => tile.id === `service:${serviceName}`);

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

  useEffect(() => {
    if (selectedService === "all") {
      return;
    }

    if (!snapshot.services.some((service) => service.name === selectedService)) {
      setSelectedService("all");
    }
  }, [selectedService, snapshot.services]);

  useEffect(() => {
    if (!snapshot.project || typeof window === "undefined") {
      return;
    }

    const source =
      hydratedProject === snapshot.project
        ? workspace
        : readWorkspaceState(window.localStorage.getItem(getWorkspaceStorageKey(snapshot.project)));
    const nextWorkspace = sanitizeWorkspaceState(source, snapshot.services);

    if (
      hydratedProject !== snapshot.project ||
      JSON.stringify(nextWorkspace) !== JSON.stringify(workspace)
    ) {
      setWorkspace(nextWorkspace);
    }

    if (hydratedProject !== snapshot.project) {
      setHydratedProject(snapshot.project);
    }
  }, [hydratedProject, snapshot.project, snapshot.services, workspace]);

  useEffect(() => {
    if (
      !snapshot.project ||
      hydratedProject !== snapshot.project ||
      typeof window === "undefined"
    ) {
      return;
    }

    window.localStorage.setItem(
      getWorkspaceStorageKey(snapshot.project),
      JSON.stringify(workspace),
    );
  }, [hydratedProject, snapshot.project, workspace]);

  const filteredLogs = filterLogs(
    snapshot.logs,
    selectedService,
    deferredSearch,
    severity,
  );
  const debugContext = formatDebugContext(snapshot);
  const workspaceTiles = sortAndReindexTiles(workspace.tiles);
  const groups = listServiceGroups(snapshot.services);

  return (
    <motion.main
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
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
          onCopyDebug={() => copyText(debugContext, "Debug context copied")}
          onExport={exportSession}
          onStopSession={() => performAction("stop-session")}
        />

        <section className="grid items-start gap-6 xl:grid-cols-[minmax(15rem,18rem)_minmax(0,1fr)]">
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

            <Card className="rounded-[1.75rem] border-white/70 bg-white/72 shadow-[0_20px_50px_rgba(15,23,42,0.08)] backdrop-blur-xl">
              <CardContent className="grid gap-4 p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
                      <LayoutGrid className="size-4" />
                      Tile workspace
                    </div>
                    <div className="mt-1 text-sm text-slate-500">
                      Drag to reorder. Settings persist.
                    </div>
                  </div>

                  <div className="relative">
                    <Button
                      id="add-tile-toggle-button"
                      aria-label="Add tile menu"
                      onClick={() => setIsAddMenuOpen((prev) => !prev)}
                      className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 shadow-sm transition hover:bg-slate-50"
                      variant="outline"
                    >
                      <Plus className="size-4" />
                      Add tile
                    </Button>

                    <AnimatePresence>
                      {isAddMenuOpen && (
                        <motion.div
                          id="add-tile-menu-container"
                          initial={{ opacity: 0, y: -10, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -10, scale: 0.95 }}
                          transition={{ type: "spring", stiffness: 450, damping: 30 }}
                          className="absolute right-0 top-full mt-2 z-50 grid gap-3 rounded-[1.5rem] border border-slate-200 bg-white p-3 shadow-[0_18px_40px_rgba(15,23,42,0.08)] lg:min-w-[26rem]"
                        >
                          <div className="grid gap-2">
                            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Streams</div>
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                disabled={isUnifiedAdded}
                                onClick={() => {
                                  setWorkspace((current) => addWorkspaceTile(current, "unified", "all"));
                                  setIsAddMenuOpen(false);
                                }}
                                className={cn(
                                  buttonVariants({ size: "sm", variant: "outline" }),
                                  "rounded-full text-xs font-medium cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                )}
                              >
                                {isUnifiedAdded ? "✓ Unified stream" : "Add Unified stream"}
                              </button>
                            </div>
                          </div>

                          <div className="grid gap-2">
                            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Groups</div>
                            <div className="flex flex-wrap gap-2">
                              {groups.length === 0 ? (
                                <span className="text-sm text-slate-500">No config groups yet</span>
                              ) : (
                                groups.map((group) => {
                                  const added = isGroupAdded(group);
                                  return (
                                    <button
                                      key={group}
                                      type="button"
                                      disabled={added}
                                      onClick={() => {
                                        setWorkspace((current) => addWorkspaceTile(current, "group", group));
                                        setIsAddMenuOpen(false);
                                      }}
                                      className={cn(
                                        buttonVariants({ size: "sm", variant: "outline" }),
                                        "rounded-full text-xs font-medium cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                      )}
                                    >
                                      {added ? `✓ ${group}` : `Add group ${group}`}
                                    </button>
                                  );
                                })
                              )}
                            </div>
                          </div>

                          <div className="grid gap-2">
                            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Services</div>
                            <div className="flex flex-wrap gap-2">
                              {snapshot.services.map((service) => {
                                const added = isServiceAdded(service.name);
                                return (
                                  <button
                                    key={service.name}
                                    type="button"
                                    disabled={added}
                                    onClick={() => {
                                      setWorkspace((current) => addWorkspaceTile(current, "service", service.name));
                                      setIsAddMenuOpen(false);
                                    }}
                                    className={cn(
                                      buttonVariants({ size: "sm", variant: "outline" }),
                                      "rounded-full text-xs font-medium cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                    )}
                                  >
                                    {added ? `✓ ${service.name}` : `Add service ${service.name}`}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                <div className="grid gap-4 xl:grid-cols-12">
                  <AnimatePresence mode="popLayout">
                    {workspaceTiles.map((tile, index) => {
                      const tileLogs =
                        tile.scopeType === "unified"
                          ? filteredLogs
                          : filterLogsForTile(tile, snapshot.logs, snapshot.services);
                      const tileServices = getTileServices(tile, snapshot.services);
                      const tileTitle = getTileTitle(tile);

                      return (
                        <motion.article
                          layout
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          transition={{ type: "spring", stiffness: 350, damping: 25 }}
                          key={tile.id}
                          className={cn(
                            "grid gap-3 rounded-[1.75rem] border p-3 backdrop-blur-xl transition-colors duration-300",
                            tileSizeClass(tile),
                            tileCardColorClass(tile.color),
                            draggedTileId === tile.id && "opacity-40 scale-[0.98]",
                          )}
                          data-testid={`workspace-tile-${tile.id}`}
                          draggable
                          onDragEnd={() => setDraggedTileId(null)}
                          onDragOver={(event) => event.preventDefault()}
                          onDragStart={() => setDraggedTileId(tile.id)}
                          onDragEnter={(event) => {
                            event.preventDefault();
                            if (draggedTileId && draggedTileId !== tile.id) {
                              setWorkspace((current) => reorderWorkspaceTiles(current, draggedTileId, tile.id));
                            }
                          }}
                        onDrop={() => {
                          setDraggedTileId(null);
                        }}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <Badge className="rounded-full px-2.5 bg-slate-900/90 text-white hover:bg-slate-900">
                                {tile.scopeType}
                              </Badge>
                              <span className="text-xs uppercase tracking-[0.14em] text-slate-500">
                                {tileServices.length} service{tileServices.length === 1 ? "" : "s"}
                              </span>
                            </div>
                            <div>
                              <div className="text-lg font-semibold text-slate-950">{tileTitle}</div>
                              <div className="text-sm text-slate-500">{getTileSubtitle(tile)}</div>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            {index > 0 ? (
                              <Button
                                aria-label={`Move earlier ${tileTitle}`}
                                className="rounded-full bg-white/85"
                                onClick={() =>
                                  setWorkspace((current) =>
                                    reorderWorkspaceTiles(current, tile.id, workspaceTiles[index - 1]!.id),
                                  )
                                }
                                size="icon-sm"
                                variant="outline"
                              >
                                <ArrowLeft className="size-4" />
                              </Button>
                            ) : null}
                            <Button
                              aria-label={`Drag ${tileTitle}`}
                              className="rounded-full bg-white/85"
                              size="icon-sm"
                              variant="outline"
                            >
                              <GripVertical className="size-4" />
                            </Button>
                            <Button
                              aria-label={`Resize ${tileTitle}`}
                              className="rounded-full bg-white/85"
                              onClick={() => setWorkspace((current) => cycleTileSize(current, tile.id))}
                              size="icon-sm"
                              variant="outline"
                            >
                              <Rows3 className="size-4" />
                            </Button>
                            <Button
                              aria-label={`Recolor ${tileTitle}`}
                              className="rounded-full bg-white/85"
                              onClick={() => setWorkspace((current) => cycleTileColor(current, tile.id))}
                              size="icon-sm"
                              variant="outline"
                            >
                              <PaintBucket className="size-4" />
                            </Button>
                            <Button
                              aria-label={`Remove ${tileTitle}`}
                              className="rounded-full bg-white/85"
                              onClick={() => setWorkspace((current) => removeWorkspaceTile(current, tile.id))}
                              size="icon-sm"
                              variant="outline"
                            >
                              <X className="size-4" />
                            </Button>
                          </div>
                        </div>

                        <LogStream
                          color={tile.color}
                          connectionState={connectionState}
                          hasReceivedSnapshot={hasReceivedSnapshot}
                          heightClass={tileHeightClass(tile)}
                          logs={tileLogs}
                          reconnectAttempt={reconnectAttempt}
                          services={tileServices}
                          subtitle={tile.scopeType === "unified" ? "Search, severity, and rail selection apply here" : undefined}
                          title={tileTitle}
                        />
                      </motion.article>
                    );
                  })}
                  </AnimatePresence>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
      </div>
    </motion.main>
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

function readWorkspaceState(source: string | null): unknown {
  if (!source) {
    return createDefaultWorkspace();
  }

  try {
    return JSON.parse(source);
  } catch {
    return createDefaultWorkspace();
  }
}

function tileSizeClass(tile: WorkspaceTile): string {
  if (tile.size === "lg") {
    return "xl:col-span-12";
  }

  if (tile.size === "md") {
    return "xl:col-span-6";
  }

  return "xl:col-span-4";
}

function tileHeightClass(tile: WorkspaceTile): string {
  if (tile.size === "lg") {
    return "h-[34rem]";
  }

  if (tile.size === "md") {
    return "h-[30rem]";
  }

  return "h-[24rem]";
}

function tileCardColorClass(color: WorkspaceTile["color"]): string {
  if (color === "sky") return "bg-sky-100/70 border-sky-300/60 shadow-[0_20px_50px_rgba(14,165,233,0.08)] text-sky-950";
  if (color === "mint") return "bg-emerald-100/70 border-emerald-300/60 shadow-[0_20px_50px_rgba(16,185,129,0.08)] text-emerald-950";
  if (color === "amber") return "bg-amber-100/70 border-amber-300/60 shadow-[0_20px_50px_rgba(245,158,11,0.08)] text-amber-950";
  if (color === "rose") return "bg-rose-100/70 border-rose-300/60 shadow-[0_20px_50px_rgba(244,63,94,0.08)] text-rose-950";
  return "bg-white/72 border-white/70 shadow-[0_20px_50px_rgba(15,23,42,0.08)] text-slate-950";
}

function tileBadgeClass(color: WorkspaceTile["color"]): string {
  if (color === "sky") return "bg-sky-500 text-white";
  if (color === "mint") return "bg-emerald-500 text-white";
  if (color === "amber") return "bg-amber-500 text-white";
  if (color === "rose") return "bg-rose-500 text-white";
  return "bg-slate-900 text-white";
}
