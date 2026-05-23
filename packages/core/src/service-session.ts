import { LogBuffer, DEFAULT_MAX_LOG_LINES } from "./log-buffer.js";
import type { LogEvent } from "./log-event.js";
import { ProcessRunner, type ProcessRunnerEvent, type ServiceDefinition } from "./process-runner.js";

export type ServiceStatus =
  | "idle"
  | "starting"
  | "running"
  | "stopping"
  | "stopped"
  | "exited"
  | "error";

export type ServiceHealth = "unknown" | "healthy" | "unreachable";

export type ServiceSnapshot = ServiceDefinition & {
  health: ServiceHealth;
  status: ServiceStatus;
  pid: number | null;
  restartCount: number;
  lastExitCode: number | null;
  lastSignal: NodeJS.Signals | null;
  lastError: string | null;
};

export type SessionSnapshot = {
  project: string;
  startedAt: string;
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
    };

export type ServiceSessionOptions = {
  project: string;
  services: ServiceDefinition[];
  maxLogLines?: number;
};

export class ServiceSession {
  readonly project: string;
  readonly startedAt: string;

  #logBuffer: LogBuffer;
  #listeners = new Set<(event: SessionEvent) => void>();
  #runners = new Map<string, ProcessRunner>();
  #services = new Map<string, ServiceSnapshot>();

  constructor(options: ServiceSessionOptions) {
    this.project = options.project;
    this.startedAt = new Date().toISOString();
    this.#logBuffer = new LogBuffer(options.maxLogLines ?? DEFAULT_MAX_LOG_LINES);

    for (const service of options.services) {
      const runner = new ProcessRunner(service);
      const snapshot: ServiceSnapshot = {
        ...service,
        health: "unknown",
        status: "idle",
        pid: null,
        restartCount: 0,
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
      project: this.project,
      startedAt: this.startedAt,
      services: [...this.#services.values()],
      logs: this.#logBuffer.snapshot(),
    };
  }

  async startAll(): Promise<void> {
    for (const [serviceName, runner] of this.#runners) {
      this.updateService(serviceName, { status: "starting", lastError: null });

      try {
        await runner.start();
      } catch (error) {
        this.updateService(serviceName, {
          status: "error",
          lastError: (error as Error).message,
        });
      }
    }
  }

  async stopAll(): Promise<void> {
    for (const [serviceName, runner] of this.#runners) {
      this.updateService(serviceName, { status: "stopping" });
      await runner.stop();
    }
  }

  async restartService(serviceName: string): Promise<void> {
    const runner = this.getRunner(serviceName);
    this.updateService(serviceName, { status: "stopping" });
    await runner.restart();
  }

  async startService(serviceName: string): Promise<void> {
    const runner = this.getRunner(serviceName);
    this.updateService(serviceName, { status: "starting", lastError: null });

    try {
      await runner.start();
    } catch (error) {
      this.updateService(serviceName, {
        status: "error",
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
    this.updateService(serviceName, { health });
  }

  handleRunnerEvent(event: ProcessRunnerEvent): void {
    if (event.type === "start") {
      this.updateService(event.service, {
        status: "running",
        pid: event.pid,
        lastError: null,
      });
      return;
    }

    if (event.type === "output") {
      this.#logBuffer.append(event.log);
      this.emit({ type: "log", log: event.log });
      return;
    }

    if (event.type === "exit") {
      this.updateService(event.service, {
        status: "exited",
        pid: null,
        lastExitCode: event.code,
        lastSignal: event.signal,
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
      this.updateService(event.service, {
        restartCount: event.count,
      });
      return;
    }

    if (event.type === "stop") {
      this.updateService(event.service, {
        status: "stopped",
        pid: null,
      });
    }
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
    this.emit({ type: "service", service: updated });
  }

  emit(event: SessionEvent): void {
    for (const listener of this.#listeners) {
      listener(event);
    }
  }
}
