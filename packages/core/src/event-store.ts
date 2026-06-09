import { appendFileSync, mkdirSync } from "node:fs";
import path from "node:path";

import {
  createEventId,
  severityNumberForText,
  type DevDeckEvent,
  type DevDeckEventInput,
  type DevDeckEventType,
  type SeverityText,
} from "./events.js";

export type EventStoreOptions = {
  sessionId: string;
  project: string;
  maxEvents?: number;
  persistPath?: string;
  redactValues?: string[];
};

export type EventQueryFilters = {
  service?: string;
  type?: DevDeckEventType;
  severity?: SeverityText;
  tail?: number;
  since?: string;
  sinceTimestamp?: string;
  grep?: string;
};

export class EventStore {
  readonly sessionId: string;
  readonly project: string;
  readonly maxEvents: number;

  #counter = 0;
  #events: DevDeckEvent[] = [];
  #listeners = new Set<(event: DevDeckEvent) => void>();
  #persistPath?: string;
  #redactValues: string[];

  constructor(options: EventStoreOptions) {
    this.sessionId = options.sessionId;
    this.project = options.project;
    this.maxEvents = options.maxEvents ?? 1_000;
    this.#persistPath = options.persistPath;
    this.#redactValues = options.redactValues ?? [];

    if (this.#persistPath) {
      mkdirSync(path.dirname(this.#persistPath), { recursive: true });
    }
  }

  append(eventInput: DevDeckEventInput): DevDeckEvent {
    this.#counter += 1;
    const timestamp = new Date().toISOString();
    const severityText = eventInput.severityText;
    const event: DevDeckEvent = this.redact({
      schemaVersion: "devdeck.event.v1",
      id: createEventId(this.#counter),
      sessionId: this.sessionId,
      project: this.project,
      timestamp,
      observedTimestamp: timestamp,
      ...eventInput,
      severityNumber:
        eventInput.severityNumber ??
        (severityText ? severityNumberForText(severityText) : undefined),
    });

    this.#events.push(event);
    if (this.#events.length > this.maxEvents) {
      this.#events.splice(0, this.#events.length - this.maxEvents);
    }

    if (this.#persistPath) {
      appendFileSync(this.#persistPath, `${JSON.stringify(event)}\n`, "utf8");
    }

    for (const listener of this.#listeners) {
      listener(event);
    }

    return event;
  }

  snapshot(): DevDeckEvent[] {
    return [...this.#events];
  }

  latestCursor(): string | null {
    return this.#events.at(-1)?.id ?? null;
  }

  query(filters: EventQueryFilters = {}): DevDeckEvent[] {
    let events = this.#events;

    if (filters.since) {
      const sinceIndex = events.findIndex((event) => event.id === filters.since);
      events = sinceIndex === -1 ? [] : events.slice(sinceIndex + 1);
    }

    if (filters.sinceTimestamp) {
      events = events.filter((event) => event.timestamp > filters.sinceTimestamp!);
    }

    if (filters.service) {
      events = events.filter((event) => event.service === filters.service);
    }

    if (filters.type) {
      events = events.filter((event) => event.type === filters.type);
    }

    if (filters.severity) {
      events = events.filter((event) => event.severityText === filters.severity);
    }

    if (filters.grep) {
      const needle = filters.grep.toLowerCase();
      events = events.filter((event) => event.body?.toLowerCase().includes(needle));
    }

    if (filters.tail !== undefined) {
      events = events.slice(-filters.tail);
    }

    return [...events];
  }

  subscribe(listener: (event: DevDeckEvent) => void): () => void {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  }

  close(): Promise<void> {
    return Promise.resolve();
  }

  private redact(event: DevDeckEvent): DevDeckEvent {
    if (this.#redactValues.length === 0) {
      return event;
    }

    let serialized = JSON.stringify(event);
    for (const value of this.#redactValues) {
      if (value) {
        serialized = serialized.split(value).join("[REDACTED]");
      }
    }

    return JSON.parse(serialized) as DevDeckEvent;
  }
}
