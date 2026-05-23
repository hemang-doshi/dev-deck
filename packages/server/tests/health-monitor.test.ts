import { afterEach, describe, expect, it, vi } from "vitest";

import { ServiceSession } from "@devdeck/core";

import { startHealthMonitor } from "../src/health-monitor.js";

describe("startHealthMonitor", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not fan out unchanged health updates while polling", async () => {
    vi.useFakeTimers();

    const session = new ServiceSession({
      project: "sample",
      services: [
        {
          name: "web",
          command: "npm run dev",
          cwd: "/tmp/web",
        },
      ],
    });
    const events: Array<{ type: string }> = [];
    const unsubscribe = session.subscribe((event) => {
      events.push(event);
    });

    const monitor = startHealthMonitor(session);
    await vi.advanceTimersByTimeAsync(2_100);

    monitor.stop();
    unsubscribe();

    expect(events).toHaveLength(0);
  });
});
