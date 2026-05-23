import net from "node:net";

import type { ServiceSession } from "@devdeck/core";

export function startHealthMonitor(session: ServiceSession): { stop: () => void } {
  const timer = setInterval(() => {
    void updateHealth(session);
  }, 1_000);

  void updateHealth(session);

  return {
    stop() {
      clearInterval(timer);
    },
  };
}

async function updateHealth(session: ServiceSession): Promise<void> {
  const snapshot = session.getSnapshot();

  await Promise.all(
    snapshot.services.map(async (service) => {
      if (!service.port || service.status !== "running") {
        session.setServiceHealth(service.name, "unknown");
        return;
      }

      const healthy = await checkPort(service.port);
      session.setServiceHealth(service.name, healthy ? "healthy" : "unreachable");
    }),
  );
}

function checkPort(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect({ host: "127.0.0.1", port });
    const timeout = setTimeout(() => {
      socket.destroy();
      resolve(false);
    }, 300);

    socket.once("connect", () => {
      clearTimeout(timeout);
      socket.end();
      resolve(true);
    });

    socket.once("error", () => {
      clearTimeout(timeout);
      resolve(false);
    });
  });
}
