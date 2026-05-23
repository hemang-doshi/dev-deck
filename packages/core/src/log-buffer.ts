import type { LogEvent } from "./log-event.js";

export const DEFAULT_MAX_LOG_LINES = 500;

export class LogBuffer {
  readonly maxLines: number;
  #entries: LogEvent[] = [];

  constructor(maxLines: number = DEFAULT_MAX_LOG_LINES) {
    this.maxLines = maxLines;
  }

  append(entry: LogEvent): void {
    this.#entries.push(entry);

    if (this.#entries.length > this.maxLines) {
      this.#entries.splice(0, this.#entries.length - this.maxLines);
    }
  }

  snapshot(): LogEvent[] {
    return [...this.#entries];
  }

  clear(): void {
    this.#entries = [];
  }
}
