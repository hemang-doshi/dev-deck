import path from "node:path";

import { LogBuffer, DEFAULT_MAX_LOG_LINES } from "./log-buffer.js";
import type { LogEvent } from "./log-event.js";
import { EventStore } from "./event-store.js";
import type { DevDeckEvent } from "./events.js";
import { serviceLogEvent } from "./events.js";
import { runHealthProbe } from "./health-probes.js";
import { ProcessRunner, type ProcessRunnerEvent, type ServiceDefinition } from "./process-runner.js";
import { waitForReadinessProbe } from "./readiness-probes.js";

export type ServiceStatus =
  | "idle"
  | "starting"
  | "running"
  | "stopping"
  | "stopped"
  | "exited"
  | "blocked"
  | "error";

export type ServiceReadiness = "unknown" | "pending" | "ready" | "failed";
export type ServiceHealth = "unknown" | "healthy" | "unreachable" | "degraded";

export type ServiceSnapshot = Omit<ServiceDefinition, "env"> & {
  health: ServiceHealth;
  readiness: ServiceReadiness;
  status: ServiceStatus;
  pid: number | null;
  restartCount: number;
  blockedBy: string[];
  lastReadyAt: string | null;
  lastHealthCheckAt: string | null;
  lastExitCode: number | null;
  lastSignal: NodeJS.Signals | null;
  lastError: string | null;
};

export type SessionSnapshot = {
  sessionId: string;
  project: string;
  projectRoot?: string;
  runDirectory?: string;
  startedAt: string;
  eventCursor: string | null;
  services: ServiceSnapshot[];
  logs: LogEvent[];
};

export type SessionEvent =
  | {
      type: "service";
      service: ServiceSnapshot;
    }
  | {
      type: "log";
      log: LogEvent;
    }
  | {
      type: "event";
      event: DevDeckEvent;
    };

export type ServiceSessionOptions = {
  sessionId?: string;
  project: string;
  projectRoot?: string;
  runDirectory?: string;
  services: ServiceDefinition[];
  eventStore?: EventStore;
  maxLogLines?: number;
};

export class ServiceSession {
  readonly sessionId: string;
  readonly project: string;
  readonly projectRoot?: string;
  readonly runDirectory?: string;
  readonly startedAt: string;
  readonly events: EventStore;

  #logBuffer: LogBuffer;
  #listeners = new Set<(event: SessionEvent) => void>();
  #runners = new Map<string, ProcessRunner>();
  #services = new Map<string, ServiceSnapshot>();
  #logReadinessResolvers = new Map<string, () => void>();

  constructor(options: ServiceSessionOptions) {
    this.sessionId = options.sessionId ?? `session-${Date.now().toString(36)}`;
    this.project = options.project;
    this.projectRoot = options.projectRoot;
    this.runDirectory = options.runDirectory ?? (
      options.projectRoot ? path.join(options.projectRoot, ".devdeck", "runs", this.sessionId) : undefined
    );
    this.startedAt = new Date().toISOString();
    this.#logBuffer = new LogBuffer(options.maxLogLines ?? DEFAULT_MAX_LOG_LINES);
    this.events = options.eventStore ?? new EventStore({
      sessionId: this.sessionId,
      project: this.project,
      persistPath: this.runDirectory ? path.join(this.runDirectory, "events.jsonl") : undefined,
    });
    this.appendCanonicalEvent({ type: "session.started" });

    for (const service of options.services) {
      const runner = new ProcessRunner(service);
      const { env, ...publicService } = service;
      const snapshot: ServiceSnapshot = {
        ...publicService,
        health: "unknown",
        readiness: "unknown",
        status: "idle",
        pid: null,
        restartCount: 0,
        blockedBy: [],
        lastReadyAt: null,
        lastHealthCheckAt: null,
        lastExitCode: null,
        lastSignal: null,
        lastError: null,
      };

      runner.subscribe((event) => this.handleRunnerEvent(event));
      this.#runners.set(service.name, runner);
      this.#services.set(service.name, snapshot);
    }
  }

  subscribe(listener: (event: SessionEvent) => void): () => void {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  }

  getSnapshot(): SessionSnapshot {
    return {
      sessionId: this.sessionId,
      project: this.project,
      projectRoot: this.projectRoot,
      runDirectory: this.runDirectory,
      startedAt: this.startedAt,
      eventCursor: this.events.latestCursor(),
      services: [...this.#services.values()],
      logs: this.#logBuffer.snapshot(),
    };
  }

  async startAll(): Promise<void> {
    const pending = new Set(this.#runners.keys());
    const inFlight = new Map<string, Promise<void>>();

    while (pending.size > 0) {
      const readyToStart = [...pending].filter((serviceName) =>
        this.dependenciesSatisfied(serviceName),
      );

      if (readyToStart.length === 0) {
        if (inFlight.size > 0) {
          await new Promise((resolve) => setTimeout(resolve, 25));
          continue;
        }

        for (const serviceName of pending) {
          this.updateService(serviceName, {
            status: "blocked",
            blockedBy: this.unsatisfiedDependencies(serviceName),
            lastError: "Service dependencies were not satisfied.",
          });
        }
        return;
      }

      for (const serviceName of readyToStart) {
        pending.delete(serviceName);
        const task = this.startService(serviceName, {
          waitForHealth: this.hasPendingHealthyDependent(serviceName, pending),
        }).finally(() => {
          inFlight.delete(serviceName);
        });
        inFlight.set(serviceName, task);
      }
    }

    await Promise.all(inFlight.values());
  }

  async stopAll(): Promise<void> {
    this.appendCanonicalEvent({ type: "session.stopping" });
    for (const [serviceName, runner] of this.#runners) {
      this.updateService(serviceName, { status: "stopping" });
      await runner.stop();
    }
    this.appendCanonicalEvent({ type: "session.stopped" });
  }

  async restartService(serviceName: string): Promise<void> {
    const runner = this.getRunner(serviceName);
    this.updateService(serviceName, { status: "stopping" });
    await runner.restart();
  }

  async startService(
    serviceName: string,
    options: { waitForHealth?: boolean } = {},
  ): Promise<void> {
    const runner = this.getRunner(serviceName);
    this.updateService(serviceName, {
      status: "starting",
      readiness: "pending",
      blockedBy: [],
      lastError: null,
    });

    try {
      await runner.start();
      await this.waitForReadiness(serviceName);
      if (options.waitForHealth) {
        await this.waitForInitialHealth(serviceName);
      } else {
        await this.refreshServiceHealth(serviceName);
      }
    } catch (error) {
      this.updateService(serviceName, {
        status: "error",
        readiness: "failed",
        lastError: (error as Error).message,
      });
    }
  }

  async stopService(serviceName: string): Promise<void> {
    const runner = this.getRunner(serviceName);
    this.updateService(serviceName, { status: "stopping" });
    await runner.stop();
  }

  setServiceHealth(serviceName: string, health: ServiceHealth): void {
    const current = this.#services.get(serviceName);

    if (current?.health === health) {
      this.#services.set(serviceName, {
        ...current,
        lastHealthCheckAt: new Date().toISOString(),
      });
      return;
    }

    this.updateService(serviceName, {
      health,
      lastHealthCheckAt: new Date().toISOString(),
    });
  }

  handleRunnerEvent(event: ProcessRunnerEvent): void {
    if (event.type === "start") {
      const current = this.#services.get(event.service);
      this.appendCanonicalEvent({
        type: "service.spawned",
        service: event.service,
        attributes: { pid: event.pid },
      });
      this.updateService(event.service, {
        status: "running",
        pid: event.pid,
        lastError: null,
      });
      if ((current?.restartCount ?? 0) > 0) {
        void this.waitForReadiness(event.service).then(() =>
          this.waitForInitialHealth(event.service),
        );
      }
      return;
    }

    if (event.type === "output") {
      this.appendCanonicalEvent(serviceLogEvent(event.log));
      this.#logBuffer.append(event.log);
      if (event.log.severity === "error" && !event.log.isStackTrace) {
        this.updateService(event.log.service, {
          lastError: event.log.line,
        });
      }
      this.emit({ type: "log", log: event.log });
      this.resolveLogReadiness(event.log);
      return;
    }

    if (event.type === "exit") {
      const current = this.#services.get(event.service);
      this.updateService(event.service, {
        status: "exited",
        pid: null,
        lastExitCode: event.code,
        lastSignal: event.signal,
        ...(event.code && event.code !== 0 && !current?.lastError
          ? { lastError: `${event.service} exited with code ${event.code}` }
          : {}),
      });
      return;
    }

    if (event.type === "error") {
      this.updateService(event.service, {
        status: "error",
        lastError: event.error,
      });
      return;
    }

    if (event.type === "restart") {
      this.appendCanonicalEvent({
        type: "service.pending",
        service: event.service,
        attributes: { restartCount: event.count },
      });
      this.updateService(event.service, {
        restartCount: event.count,
        readiness: "pending",
        health: "unknown",
        lastReadyAt: null,
        lastHealthCheckAt: null,
      });
      return;
    }

    if (event.type === "stop") {
      this.updateService(event.service, {
        status: "stopped",
        pid: null,
        health: "unknown",
        readiness: "unknown",
      });
    }
  }

  dependenciesSatisfied(serviceName: string): boolean {
    return this.unsatisfiedDependencies(serviceName).length === 0;
  }

  unsatisfiedDependencies(serviceName: string): string[] {
    const service = this.#services.get(serviceName);

    if (!service) {
      return [];
    }

    return Object.entries(service.dependsOn ?? {})
      .filter(([dependencyName, dependency]) => {
        const dependencySnapshot = this.#services.get(dependencyName);

        if (!dependencySnapshot) {
          return true;
        }

        if (dependencySnapshot.status === "error" || dependencySnapshot.status === "blocked") {
          return true;
        }

        if (dependency.condition === "started") {
          return dependencySnapshot.status === "idle" || dependencySnapshot.status === "starting";
        }

        if (dependency.condition === "ready") {
          return dependencySnapshot.readiness !== "ready";
        }

        if (dependency.condition === "healthy") {
          return dependencySnapshot.health !== "healthy";
        }

        return dependencySnapshot.status !== "exited" || dependencySnapshot.lastExitCode !== 0;
      })
      .map(([dependencyName]) => dependencyName);
  }

  async waitForReadiness(serviceName: string): Promise<void> {
    const service = this.#services.get(serviceName);

    if (!service) {
      return;
    }

    if (!service.readinessProbe) {
      this.updateService(serviceName, {
        readiness: "ready",
        lastReadyAt: new Date().toISOString(),
      });
      return;
    }

    if (service.readinessProbe.type === "log") {
      const pattern = service.readinessProbe.pattern;
      if (this.#logBuffer
        .snapshot()
        .some((log) => log.service === serviceName && log.line.includes(pattern))) {
        this.updateService(serviceName, {
          readiness: "ready",
          lastReadyAt: new Date().toISOString(),
        });
        return;
      }

      const ready = await this.waitForLogReadiness(serviceName, pattern);
      this.updateService(serviceName, {
        readiness: ready ? "ready" : "failed",
        lastReadyAt: ready ? new Date().toISOString() : null,
        lastError: ready ? null : "Timed out waiting for log readiness.",
      });
      return;
    }

    const ready = await waitForReadinessProbe(service, service.readinessProbe);
    this.updateService(serviceName, {
      readiness: ready ? "ready" : "failed",
      lastReadyAt: ready ? new Date().toISOString() : null,
      lastError: ready ? null : "Timed out waiting for readiness probe.",
    });
  }

  waitForLogReadiness(serviceName: string, pattern: string): Promise<boolean> {
    const service = this.#services.get(serviceName);
    const timeoutMs = service?.readinessProbe?.type === "log" ? 10_000 : 10_000;

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        this.#logReadinessResolvers.delete(serviceName);
        resolve(false);
      }, timeoutMs);

      this.#logReadinessResolvers.set(serviceName, () => {
        clearTimeout(timeout);
        resolve(true);
      });

      void pattern;
    });
  }

  resolveLogReadiness(log: LogEvent): void {
    const service = this.#services.get(log.service);

    if (service?.readinessProbe?.type !== "log") {
      return;
    }

    if (!log.line.includes(service.readinessProbe.pattern)) {
      return;
    }

    const resolver = this.#logReadinessResolvers.get(log.service);
    this.#logReadinessResolvers.delete(log.service);
    resolver?.();
  }

  async refreshServiceHealth(serviceName: string): Promise<void> {
    const service = this.#services.get(serviceName);
    const runner = this.#runners.get(serviceName);

    if (!service || !runner || service.status !== "running" || !service.healthProbe) {
      this.setServiceHealth(serviceName, "unknown");
      return;
    }

    this.setServiceHealth(serviceName, await runHealthProbe(runner.service, service.healthProbe));
  }

  async waitForInitialHealth(serviceName: string): Promise<void> {
    const service = this.#services.get(serviceName);
    const runner = this.#runners.get(serviceName);

    if (!service || !runner || service.status !== "running" || !service.healthProbe) {
      this.setServiceHealth(serviceName, "unknown");
      return;
    }

    const timeoutMs = service.healthProbe.timeoutMs ?? 10_000;
    const deadline = Date.now() + timeoutMs;
    let lastHealth: ServiceHealth = "unknown";

    while (Date.now() <= deadline) {
      lastHealth = await runHealthProbe(runner.service, service.healthProbe);
      this.setServiceHealth(serviceName, lastHealth);

      if (lastHealth === "healthy") {
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    this.setServiceHealth(serviceName, lastHealth);
  }

  hasPendingHealthyDependent(serviceName: string, pending: Set<string>): boolean {
    return [...pending].some((pendingServiceName) => {
      const pendingService = this.#services.get(pendingServiceName);
      return pendingService?.dependsOn?.[serviceName]?.condition === "healthy";
    });
  }

  getRunner(serviceName: string): ProcessRunner {
    const runner = this.#runners.get(serviceName);

    if (!runner) {
      throw new Error(`Unknown service: ${serviceName}`);
    }

    return runner;
  }

  updateService(serviceName: string, patch: Partial<ServiceSnapshot>): void {
    const current = this.#services.get(serviceName);

    if (!current) {
      return;
    }

    const changed = Object.entries(patch).some(
      ([key, value]) => current[key as keyof ServiceSnapshot] !== value,
    );

    if (!changed) {
      return;
    }

    const updated = { ...current, ...patch };
    this.#services.set(serviceName, updated);
    this.appendServiceSnapshotEvent(current, updated, patch);
    this.emit({ type: "service", service: updated });
  }

  appendCanonicalEvent(eventInput: Parameters<EventStore["append"]>[0]): DevDeckEvent {
    const event = this.events.append(eventInput);
    this.emit({ type: "event", event });
    return event;
  }

  appendServiceSnapshotEvent(
    previous: ServiceSnapshot,
    updated: ServiceSnapshot,
    patch: Partial<ServiceSnapshot>,
  ): void {
    if (patch.status === "running") {
      this.appendCanonicalEvent({
        type: "service.running",
        service: updated.name,
        attributes: { pid: updated.pid },
      });
    }

    if (patch.status === "blocked" || patch.status === "error") {
      this.appendCanonicalEvent({
        type: "service.failed",
        service: updated.name,
        severityText: "ERROR",
        body: updated.lastError ?? undefined,
        attributes: {
          status: updated.status,
          blockedBy: updated.blockedBy,
        },
      });
    }

    if (patch.status === "exited") {
      this.appendCanonicalEvent({
        type: updated.lastExitCode === 0 ? "service.exited" : "service.failed",
        service: updated.name,
        severityText: updated.lastExitCode === 0 ? "INFO" : "ERROR",
        attributes: {
          exitCode: updated.lastExitCode,
          signal: updated.lastSignal,
        },
      });
    }

    if (patch.readiness === "ready" && previous.readiness !== "ready") {
      this.appendCanonicalEvent({
        type: "service.ready",
        service: updated.name,
        attributes: { lastReadyAt: updated.lastReadyAt },
      });
    }

    if (patch.health && previous.health !== updated.health) {
      this.appendCanonicalEvent({
        type: "service.health_changed",
        service: updated.name,
        attributes: {
          previous: previous.health,
          current: updated.health,
          checkedAt: updated.lastHealthCheckAt,
        },
      });
    }
  }

  emit(event: SessionEvent): void {
    for (const listener of this.#listeners) {
      listener(event);
    }
  }
}
