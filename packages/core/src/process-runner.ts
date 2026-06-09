import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { existsSync } from "node:fs";

import { classifyLogLine } from "./classify-log-line.js";
import type { LogEvent, LogSeverity, LogStream } from "./log-event.js";

export type ServiceDefinition = {
  name: string;
  command?: string;
  exec?: { argv: string[] };
  cwd: string;
  shell?: boolean;
  group?: string;
  port?: number;
  env?: Record<string, string>;
  envFiles?: string[];
  requiredEnv?: string[];
  dependsOn?: Record<string, { condition: DependencyCondition }>;
  healthProbe?: HealthProbe;
  readinessProbe?: ReadinessProbe;
  restartPolicy?: RestartPolicy;
  stop?: StopConfig;
  links?: Array<{ label: string; url: string }>;
};

export type DependencyCondition =
  | "started"
  | "ready"
  | "healthy"
  | "completed_successfully";

export type HealthProbe =
  | { type: "tcp"; host?: string; port: number; timeoutMs?: number }
  | { type: "http"; url: string; expectedStatus?: number; timeoutMs?: number }
  | { type: "command"; command: string; timeoutMs?: number };

export type ReadinessProbe =
  | { type: "log"; pattern: string }
  | { type: "tcp"; host?: string; port: number; timeoutMs?: number }
  | { type: "http"; url: string; expectedStatus?: number; timeoutMs?: number };

export type RestartPolicy = {
  mode: "never" | "on-failure" | "always";
  maxRestarts?: number;
  delayMs?: number;
};

export type StopConfig = {
  command?: string;
  timeoutMs?: number;
};

export type ProcessRunnerEvent =
  | {
      type: "start";
      service: string;
      pid: number;
      timestamp: string;
    }
  | {
      type: "output";
      log: LogEvent;
    }
  | {
      type: "exit";
      service: string;
      code: number | null;
      signal: NodeJS.Signals | null;
      timestamp: string;
    }
  | {
      type: "error";
      service: string;
      error: string;
      timestamp: string;
    }
  | {
      type: "restart";
      service: string;
      count: number;
      timestamp: string;
    }
  | {
      type: "stop";
      service: string;
      timestamp: string;
    };

export class ProcessRunner {
  readonly service: ServiceDefinition;

  #child: ChildProcessWithoutNullStreams | null = null;
  #listeners = new Set<(event: ProcessRunnerEvent) => void>();
  #nextLogId = 1;
  #restartCount = 0;
  #stopRequested = false;
  #restartTimer: NodeJS.Timeout | null = null;

  constructor(service: ServiceDefinition) {
    this.service = service;
  }

  subscribe(listener: (event: ProcessRunnerEvent) => void): () => void {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  }

  get isRunning(): boolean {
    return this.#child !== null;
  }

  get restartCount(): number {
    return this.#restartCount;
  }

  async start(): Promise<void> {
    if (this.#child) {
      return;
    }

    this.#stopRequested = false;

    await new Promise<void>((resolve, reject) => {
      let settled = false;
      const child = this.spawnService();

      const onError = (error: Error) => {
        this.#child = null;
        this.emit({
          type: "error",
          service: this.service.name,
          error: error.message,
          timestamp: new Date().toISOString(),
        });

        if (!settled) {
          settled = true;
          reject(error);
        }
      };

      child.once("error", onError);
      child.once("spawn", () => {
        this.#child = child;
        this.attachOutput(child);
        this.attachExit(child);
        this.emit({
          type: "start",
          service: this.service.name,
          pid: child.pid ?? -1,
          timestamp: new Date().toISOString(),
        });

        if (!settled) {
          settled = true;
          resolve();
        }
      });
    });
  }

  async stop(): Promise<void> {
    if (!this.#child) {
      return;
    }

    this.#stopRequested = true;
    if (this.#restartTimer) {
      clearTimeout(this.#restartTimer);
      this.#restartTimer = null;
    }
    const child = this.#child;

    await new Promise<void>((resolve) => {
      let resolved = false;
      const timeoutMs = this.service.stop?.timeoutMs ?? 1_000;
      const finish = () => {
        if (!resolved) {
          resolved = true;
          setTimeout(resolve, 50);
        }
      };
      const timer = setTimeout(() => {
        void this.killProcessTree(child, "SIGKILL").then(finish);
      }, timeoutMs);

      child.once("exit", () => {
        clearTimeout(timer);
        finish();
      });

      if (this.service.stop?.command) {
        void this.runStopCommand();
        return;
      }

      void this.killProcessTree(child).then(() => {
        if (child.exitCode !== null || child.signalCode !== null) {
          finish();
        }
      });
    });
  }

  async restart(): Promise<void> {
    this.#restartCount += 1;
    this.emit({
      type: "restart",
      service: this.service.name,
      count: this.#restartCount,
      timestamp: new Date().toISOString(),
    });
    await this.stop();
    await this.start();
  }

  attachExit(child: ChildProcessWithoutNullStreams): void {
    child.once("exit", (code, signal) => {
      this.#child = null;

      if (this.#stopRequested) {
        this.emit({
          type: "stop",
          service: this.service.name,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      this.emit({
        type: "exit",
        service: this.service.name,
        code,
        signal,
        timestamp: new Date().toISOString(),
      });

      if (this.shouldRestart(code, signal)) {
        this.scheduleRestart();
      }
    });
  }

  attachOutput(child: ChildProcessWithoutNullStreams): void {
    const stdoutBuffer = { value: "" };
    const stderrBuffer = { value: "" };

    child.stdout.on("data", (chunk: Buffer) => {
      stdoutBuffer.value = this.flushLines(stdoutBuffer.value, chunk, "stdout");
    });

    child.stderr.on("data", (chunk: Buffer) => {
      stderrBuffer.value = this.flushLines(stderrBuffer.value, chunk, "stderr");
    });
  }

  flushLines(buffer: string, chunk: Buffer, stream: LogStream): string {
    const combined = `${buffer}${chunk.toString("utf8")}`;
    const lines = combined.split(/\r?\n/);
    const remainder = lines.pop() ?? "";

    for (const line of lines) {
      const classified = classifyLogLine(line, stream);
      this.emit({
        type: "output",
        log: {
          id: this.#nextLogId++,
          service: this.service.name,
          isStackTrace: classified.isStackTrace,
          line,
          ports: classified.ports,
          severity: classified.severity,
          stream,
          timestamp: new Date().toISOString(),
          urls: classified.urls,
        },
      });
    }

    return remainder;
  }

  emit(event: ProcessRunnerEvent): void {
    for (const listener of this.#listeners) {
      listener(event);
    }
  }

  spawnService(): ChildProcessWithoutNullStreams {
    const env = { ...process.env, ...this.service.env };

    if (this.service.exec) {
      const [command, ...args] = this.service.exec.argv;

      if (!command) {
        throw new Error(`Service '${this.service.name}' exec.argv is empty.`);
      }

      const windowsCommand = resolveWindowsCommand(command);

      if (windowsCommand) {
        const commandLine = [`"${windowsCommand}"`, ...args.map(quoteWindowsShellArgument)].join(" ");
        return spawn(commandLine, {
          cwd: this.service.cwd,
          shell: true,
          env,
        });
      }

      return spawn(command, args, {
        cwd: this.service.cwd,
        shell: false,
        env,
      });
    }

    if (!this.service.command) {
      throw new Error(`Service '${this.service.name}' does not define a command.`);
    }

    return spawn(this.service.command, {
      cwd: this.service.cwd,
      shell: this.service.shell ?? true,
      env,
    });
  }

  runStopCommand(): Promise<void> {
    if (!this.service.stop?.command) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      const child = spawn(this.service.stop?.command ?? "", {
        cwd: this.service.cwd,
        shell: true,
        env: { ...process.env, ...this.service.env },
      });
      const timer = setTimeout(() => {
        child.kill("SIGKILL");
        resolve();
      }, this.service.stop?.timeoutMs ?? 1_000);

      child.once("exit", () => {
        clearTimeout(timer);
        resolve();
      });

      child.once("error", () => {
        clearTimeout(timer);
        resolve();
      });
    });
  }

  killProcessTree(
    child: ChildProcessWithoutNullStreams,
    signal: NodeJS.Signals = "SIGTERM",
  ): Promise<void> {
    if (process.platform !== "win32" || child.pid === undefined) {
      child.kill(signal);
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      const killer = spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
        stdio: "ignore",
      });

      killer.once("exit", () => resolve());
      killer.once("error", () => {
        child.kill("SIGTERM");
        resolve();
      });
    });
  }

  shouldRestart(code: number | null, signal: NodeJS.Signals | null): boolean {
    const policy = this.service.restartPolicy ?? { mode: "never" as const };

    if (policy.mode === "never") {
      return false;
    }

    if (policy.maxRestarts !== undefined && this.#restartCount >= policy.maxRestarts) {
      return false;
    }

    if (policy.mode === "always") {
      return true;
    }

    return code !== 0 || signal !== null;
  }

  scheduleRestart(): void {
    const delayMs = this.service.restartPolicy?.delayMs ?? 0;
    this.#restartTimer = setTimeout(() => {
      this.#restartTimer = null;
      this.#restartCount += 1;
      this.emit({
        type: "restart",
        service: this.service.name,
        count: this.#restartCount,
        timestamp: new Date().toISOString(),
      });
      void this.start().catch((error: Error) => {
        this.emit({
          type: "error",
          service: this.service.name,
          error: error.message,
          timestamp: new Date().toISOString(),
        });
      });
    }, delayMs);
  }
}

function resolveWindowsCommand(command: string): string | null {
  if (process.platform !== "win32") {
    return null;
  }

  if (/\.(?:cmd|bat)$/i.test(command)) {
    return command;
  }

  for (const directory of (process.env.PATH ?? "").split(";")) {
    const candidate = `${directory}\\${command}.cmd`;

    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

function quoteWindowsShellArgument(argument: string): string {
  if (!/[\s"&|<>^]/.test(argument)) {
    return argument;
  }

  return `"${argument.replaceAll("\"", "\"\"")}"`;
}
