import { ProductValidationRecorder } from "./command-recorder.mjs";
import {
  defaultDevDeckCommand,
  ensureDevDeckCliBuilt,
  fixtureDir,
} from "./complex-fixture.mjs";

async function maybeObserveCrash(recorder, scenario) {
  if (scenario !== "api-crash-after-start") {
    return;
  }

  await recorder.runObservedCommand({
    id: "devdeck-optimized-dashboard-hit",
    command: "curl -sS http://127.0.0.1:3000/dashboard",
    commandLabel: "curl http://127.0.0.1:3000/dashboard",
    category: "failure-observation",
    allowFailure: true,
  });

}

function extractNextAction(output) {
  const match = output.match(/^NEXT\s+(.+?)\s+#/m);
  return match?.[1] ?? null;
}

export async function runDevDeckOptimizedMode({ runRoot, scenario }) {
  const recorder = new ProductValidationRecorder({
    runRoot,
    scenario,
    mode: "devdeck-optimized",
    fixtureDir,
  });

  await recorder.init();
  await ensureDevDeckCliBuilt();
  const devdeckBin = process.env.DEVDECK_BIN ?? defaultDevDeckCommand("");
  const devdeckCommand = (suffix) => `${devdeckBin}${suffix ? ` ${suffix}` : ""}`;

  try {
    await recorder.runObservedCommand({
      id: "devdeck-optimized-scenario",
      command: `npm run scenario:${scenario}`,
      category: "scenario-setup",
    });

    const start = await recorder.runObservedCommand({
      id: "devdeck-optimized-start",
      command: devdeckCommand("start --agent --wait 30"),
      commandLabel: "npx devdeck start --agent --wait 30",
      transcriptCommand: "npx devdeck start --agent --wait 30",
      category: "startup",
      allowFailure: true,
    });

    if (scenario === "noisy-worker") {
      await new Promise((resolve) => setTimeout(resolve, 1800));
    }

    await maybeObserveCrash(recorder, scenario);

    const diagnose = scenario === "startup-success"
      ? null
      : await recorder.runObservedCommand({
        id: "devdeck-optimized-diagnose-agent",
        command: devdeckCommand("diagnose --agent"),
        commandLabel: "npx devdeck diagnose --agent",
        transcriptCommand: "npx devdeck diagnose --agent",
        category: "diagnosis",
        allowFailure: true,
      });

    const nextAction = extractNextAction(diagnose?.combined || "");
    if (nextAction?.startsWith("devdeck service restart")) {
      await recorder.runObservedCommand({
        id: "devdeck-optimized-restart-agent",
        command: devdeckCommand(nextAction.replace(/^devdeck\s+/, "")),
        commandLabel: nextAction.replace(/^devdeck\s+/, "npx devdeck "),
        transcriptCommand: nextAction.replace(/^devdeck\s+/, "npx devdeck "),
        category: "recovery",
        allowFailure: true,
      });

      await recorder.runObservedCommand({
        id: "devdeck-optimized-status-post-restart",
        command: devdeckCommand("status --agent"),
        commandLabel: "npx devdeck status --agent",
        transcriptCommand: "npx devdeck status --agent",
        category: "state",
        allowFailure: true,
      });
    }

    await recorder.runObservedCommand({
      id: "devdeck-optimized-stop",
      command: devdeckCommand("stop --agent"),
      commandLabel: "npx devdeck stop --agent",
      transcriptCommand: "npx devdeck stop --agent",
      category: "cleanup",
      allowFailure: true,
    });

    await recorder.runObservedCommand({
      id: "devdeck-optimized-cleanup",
      command: "npm run cleanup",
      category: "cleanup",
      allowFailure: true,
    });

    return await recorder.finalize({
      extra: {
        devdeck: {
          command: devdeckBin,
          startupOutput: start.combined || "",
        },
      },
    });
  } catch (error) {
    await recorder.runObservedCommand({
      id: "devdeck-optimized-stop-after-error",
      command: devdeckCommand("stop --agent"),
      commandLabel: "npx devdeck stop --agent",
      transcriptCommand: "npx devdeck stop --agent",
      category: "cleanup",
      allowFailure: true,
    }).catch(() => {});
    await recorder.runObservedCommand({
      id: "devdeck-optimized-cleanup-after-error",
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
