import { mkdir, readFile, rm } from "node:fs/promises";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { EventStore } from "../src/event-store.js";

describe("EventStore", () => {
  const tempDirectories: string[] = [];

  afterEach(async () => {
    for (const directory of tempDirectories) {
      await rm(directory, { recursive: true, force: true });
    }
    tempDirectories.length = 0;
  });

  it("assigns ordered canonical event ids and bounds memory snapshots", () => {
    const store = new EventStore({
      sessionId: "session-1",
      project: "sample",
      maxEvents: 2,
    });

    const first = store.append({ type: "session.started" });
    const second = store.append({ type: "service.running", service: "api" });
    const third = store.append({ type: "service.log", service: "api", body: "ready" });

    expect(first.id).toBe("evt_000001");
    expect(second.id).toBe("evt_000002");
    expect(third.id).toBe("evt_000003");
    expect(third.schemaVersion).toBe("devdeck.event.v1");
    expect(third.sessionId).toBe("session-1");
    expect(third.project).toBe("sample");
    expect(store.latestCursor()).toBe("evt_000003");
    expect(store.snapshot().map((event) => event.id)).toEqual(["evt_000002", "evt_000003"]);
  });

  it("queries by service, type, severity, tail, and since cursor", () => {
    const store = new EventStore({ sessionId: "session-1", project: "sample" });

    store.append({ type: "service.log", service: "web", severityText: "INFO", body: "web" });
    const apiStart = store.append({ type: "service.running", service: "api" });
    store.append({ type: "service.log", service: "api", severityText: "ERROR", body: "bad" });
    store.append({ type: "service.log", service: "api", severityText: "WARN", body: "warn" });

    expect(store.query({ service: "api" }).map((event) => event.service)).toEqual(["api", "api", "api"]);
    expect(store.query({ type: "service.log" }).map((event) => event.body)).toEqual(["web", "bad", "warn"]);
    expect(store.query({ severity: "ERROR" }).map((event) => event.body)).toEqual(["bad"]);
    expect(store.query({ service: "api", tail: 1 }).map((event) => event.body)).toEqual(["warn"]);
    expect(store.query({ since: apiStart.id }).map((event) => event.body)).toEqual(["bad", "warn"]);
  });

  it("returns no events when since cursor is older than the bounded buffer", () => {
    const store = new EventStore({ sessionId: "session-1", project: "sample", maxEvents: 2 });

    const first = store.append({ type: "service.log", service: "api", body: "one" });
    store.append({ type: "service.log", service: "api", body: "two" });
    store.append({ type: "service.log", service: "api", body: "three" });

    expect(store.query({ since: first.id })).toEqual([]);
  });

  it("persists appended events as clean JSONL", async () => {
    const directory = path.resolve(process.cwd(), "../../.devdeck/event-store-tests");
    tempDirectories.push(directory);
    await mkdir(directory, { recursive: true });
    const persistPath = path.join(directory, "events.jsonl");
    const store = new EventStore({
      sessionId: "session-1",
      project: "sample",
      persistPath,
    });

    store.append({ type: "service.log", service: "api", body: "secret=redacted", attributes: { token: "redacted" } });
    await store.close();

    const lines = (await readFile(persistPath, "utf8")).trim().split("\n");
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0] ?? "{}")).toMatchObject({
      schemaVersion: "devdeck.event.v1",
      id: "evt_000001",
      type: "service.log",
      body: "secret=redacted",
    });
  });
});
