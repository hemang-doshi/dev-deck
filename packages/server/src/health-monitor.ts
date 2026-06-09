import type { ServiceSession } from "@devdeck/core";

export function startHealthMonitor(session: ServiceSession): { stop: () => void } {
  let updating = false;
  const runUpdate = async () => {
    if (updating) {
      return;
    }

    updating = true;
    try {
      await updateHealth(session);
    } finally {
      updating = false;
    }
  };
  const timer = setInterval(() => {
    void runUpdate();
  }, 1_000);

  void runUpdate();

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
      await session.refreshServiceHealth(service.name);
    }),
  );
}
