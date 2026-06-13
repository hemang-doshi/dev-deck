import { sleep } from "../_shared.mjs";
import { ProductValidationRecorder } from "./command-recorder.mjs";
import { fixtureDir, serviceStartOrder } from "./complex-fixture.mjs";

async function performScenarioObservation(recorder, scenario) {
  if (scenario === "missing-env" || scenario === "port-conflict") {
    await recorder.captureManualServiceLog("api", 80, "failure-observation");
    return;
  }

  if (scenario === "api-crash-after-start") {
    await recorder.runObservedCommand({
      id: "manual-runtime-dashboard-hit",
      command: "curl -sS http://127.0.0.1:3000/dashboard",
      commandLabel: "curl http://127.0.0.1:3000/dashboard",
      category: "failure-observation",
      allowFailure: true,
    });
    await sleep(1200);
    await recorder.runObservedCommand({
      id: "manual-runtime-health-post-crash",
      command: "npm run health",
      category: "failure-observation",
      allowFailure: true,
    });
    await recorder.captureManualServiceLog("api", 100, "failure-observation");
    return;
  }

  if (scenario === "noisy-worker") {
    await sleep(1800);
    await recorder.captureManualServiceLog("worker", 120, "logs");
  }
}

export async function runManualRuntimeMode({ runRoot, scenario }) {
  const recorder = new ProductValidationRecorder({
    runRoot,
    scenario,
    mode: "manual-runtime",
    fixtureDir,
  });

  await recorder.init();

  try {
    await recorder.runObservedCommand({
      id: "manual-runtime-scenario",
      command: `npm run scenario:${scenario}`,
      category: "scenario-setup",
    });

    for (const { serviceName, scriptName } of serviceStartOrder) {
      await recorder.startLoggedService({
        id: `manual-runtime-start-${serviceName}`,
        serviceName,
        scriptName,
      });
    }

    await recorder.runObservedCommand({
      id: "manual-runtime-health",
      command: "npm run health",
      category: "health-check",
      allowFailure: true,
    });

    await performScenarioObservation(recorder, scenario);

    await recorder.runObservedCommand({
      id: "manual-runtime-cleanup",
      command: "npm run cleanup",
      category: "cleanup",
      allowFailure: true,
    });

    await recorder.disposeServiceHandles();
    return await recorder.finalize();
  } catch (error) {
    await recorder.runObservedCommand({
      id: "manual-runtime-cleanup-after-error",
      command: "npm run cleanup",
      category: "cleanup",
      allowFailure: true,
    }).catch(() => {});
    await recorder.disposeServiceHandles();
    return await recorder.finalize({
      exitCode: 1,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
