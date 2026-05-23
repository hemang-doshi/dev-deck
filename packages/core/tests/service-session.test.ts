import { describe, expect, it } from "vitest";

import { ServiceSession } from "../src/service-session.js";

describe("ServiceSession", () => {
  it("does not emit a service event when health is unchanged", () => {
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

    session.subscribe((event) => {
      events.push(event);
    });

    session.setServiceHealth("web", "unknown");

    expect(events).toHaveLength(0);
  });
});
