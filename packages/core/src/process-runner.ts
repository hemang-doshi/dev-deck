import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";

import { classifyLogLine } from "./classify-log-line.js";
import type { LogEvent, LogSeverity, LogStream } from "./log-event.js";

export type ServiceDefinition = {
  name: string;
  command: string;
  cwd: string;
  port?: number;
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
      const child = spawn(this.service.command, {
        cwd: this.service.cwd,
        shell: true,
        env: process.env,
      });

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
    const child = this.#child;

    await new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        child.kill("SIGKILL");
      }, 1_000);

      child.once("exit", () => {
        clearTimeout(timer);
        resolve();
      });

      child.kill("SIGTERM");
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
}
