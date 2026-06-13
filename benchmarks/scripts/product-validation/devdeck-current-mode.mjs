import { ProductValidationRecorder } from "./command-recorder.mjs";
import {
  defaultDevDeckCommand,
  ensureDevDeckCliBuilt,
  fixtureDir,
  serviceNames,
} from "./complex-fixture.mjs";

async function collectDevDeckServiceLogs(recorder, devdeckBin) {
  for (const serviceName of serviceNames) {
    await recorder.captureDevDeckServiceLog(
      serviceName,
      `${devdeckBin} logs ${serviceName} --tail 120`,
    );
  }
}

async function performScenarioObservation(recorder, scenario) {
  if (scenario === "api-crash-after-start") {
    await recorder.runObservedCommand({
      id: "devdeck-current-dashboard-hit",
      command: "curl -sS http://127.0.0.1:3000/dashboard",
      commandLabel: "curl http://127.0.0.1:3000/dashboard",
      category: "failure-observation",
      allowFailure: true,
    });
    await recorder.runObservedCommand({
      id: "devdeck-current-health-post-crash",
      command: "npm run health",
      category: "failure-observation",
      allowFailure: true,
    });
  }
}

export async function runDevDeckCurrentMode({ runRoot, scenario }) {
  const recorder = new ProductValidationRecorder({
    runRoot,
    scenario,
    mode: "devdeck-current",
    fixtureDir,
  });

  await recorder.init();
  await ensureDevDeckCliBuilt();
  const devdeckBin = process.env.DEVDECK_BIN ?? defaultDevDeckCommand("");
  const devdeckCommand = (suffix) => `${devdeckBin}${suffix ? ` ${suffix}` : ""}`;

  try {
    await recorder.runObservedCommand({
      id: "devdeck-current-scenario",
      command: `npm run scenario:${scenario}`,
      category: "scenario-setup",
    });

    await recorder.runObservedCommand({
      id: "devdeck-current-start",
      command: devdeckCommand("start"),
      commandLabel: "npx devdeck start",
      transcriptCommand: "npx devdeck start",
      category: "startup",
      allowFailure: true,
    });

    await recorder.runObservedCommand({
      id: "devdeck-current-status-agent",
      command: devdeckCommand("status --agent"),
      commandLabel: "npx devdeck status --agent",
      transcriptCommand: "npx devdeck status --agent",
      category: "state",
      allowFailure: true,
    });

    await recorder.runObservedCommand({
      id: "devdeck-current-health",
      command: "npm run health",
      category: "health-check",
      allowFailure: true,
    });

    await performScenarioObservation(recorder, scenario);
    await collectDevDeckServiceLogs(recorder, devdeckBin);

    await recorder.runObservedCommand({
      id: "devdeck-current-stop",
      command: devdeckCommand("stop"),
      commandLabel: "npx devdeck stop",
      transcriptCommand: "npx devdeck stop",
      category: "cleanup",
      allowFailure: true,
    });

    await recorder.runObservedCommand({
      id: "devdeck-current-cleanup",
      command: "npm run cleanup",
      category: "cleanup",
      allowFailure: true,
    });

    return await recorder.finalize({
      extra: {
        devdeck: {
          command: devdeckBin,
        },
      },
    });
  } catch (error) {
    await recorder.runObservedCommand({
      id: "devdeck-current-stop-after-error",
      command: devdeckCommand("stop"),
      commandLabel: "npx devdeck stop",
      transcriptCommand: "npx devdeck stop",
      category: "cleanup",
      allowFailure: true,
    }).catch(() => {});
    await recorder.runObservedCommand({
      id: "devdeck-current-cleanup-after-error",
      command: "npm run cleanup",
      category: "cleanup",
      allowFailure: true,
    }).catch(() => {});

    return await recorder.finalize({
      exitCode: 1,
      error: error instanceof Error ? error.message : String(error),
      extra: {
        devdeck: {
          command: devdeckBin,
        },
      },
    });
  }
}
