import { checkTcp } from "./health-probes.js";
import type { ReadinessProbe, ServiceDefinition } from "./process-runner.js";

const DEFAULT_TIMEOUT_MS = 10_000;
const POLL_INTERVAL_MS = 100;

export async function waitForReadinessProbe(
  service: ServiceDefinition,
  probe: Exclude<ReadinessProbe, { type: "log" }>,
): Promise<boolean> {
  const deadline = Date.now() + (probe.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  while (Date.now() <= deadline) {
    if (probe.type === "tcp") {
      if (await checkTcp(probe.host ?? "127.0.0.1", probe.port, 300)) {
        return true;
      }
    }

    if (probe.type === "http") {
      if (await checkHttp(probe.url, probe.expectedStatus ?? 200, 300)) {
        return true;
      }
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  void service;
  return false;
}

async function checkHttp(
  url: string,
  expectedStatus: number,
  timeoutMs: number,
): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { signal: controller.signal });
    return response.status === expectedStatus;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}
