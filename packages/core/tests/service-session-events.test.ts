import { describe, expect, it } from "vitest";

import { ServiceSession } from "../src/service-session.js";

describe("ServiceSession canonical events", () => {
  it("includes session identity and event cursor in snapshots", () => {
    const session = new ServiceSession({
      sessionId: "session-test",
      project: "sample",
      projectRoot: process.cwd(),
      services: [],
    });

    expect(session.getSnapshot()).toMatchObject({
      sessionId: "session-test",
      project: "sample",
      projectRoot: process.cwd(),
      eventCursor: "evt_000001",
    });
  });

  it("emits canonical service lifecycle and log events", async () => {
    const session = new ServiceSession({
      sessionId: "session-test",
      project: "sample",
      services: [
        {
          name: "api",
          command: "node -e \"console.log('ready'); setTimeout(() => process.exit(0), 20)\"",
          cwd: process.cwd(),
        },
      ],
    });

    await session.startAll();
    await waitFor(() => session.events.query({ type: "service.exited" }).length > 0);

    const events = session.events.snapshot();
    expect(events.map((event) => event.type)).toContain("service.spawned");
    expect(events.map((event) => event.type)).toContain("service.running");
    expect(events.map((event) => event.type)).toContain("service.ready");
    expect(events.find((event) => event.type === "service.log")).toMatchObject({
      service: "api",
      stream: "stdout",
      body: "ready",
    });
    expect(session.getSnapshot().eventCursor).toBe(events.at(-1)?.id);
  });
});

async function waitFor(assertion: () => boolean, timeoutMs: number = 2_000): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    if (assertion()) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 25));
  }

  throw new Error("Timed out waiting for condition");
}
