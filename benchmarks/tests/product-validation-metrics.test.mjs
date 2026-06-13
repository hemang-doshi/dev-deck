import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { ProductValidationRecorder } from "../scripts/product-validation/command-recorder.mjs";
import { supportedModes } from "../scripts/product-validation/complex-fixture.mjs";

test("product validation recorder keeps hidden evaluator commands out of transcript but records them in events", async () => {
  const runRoot = await mkdtemp(path.join(os.tmpdir(), "devdeck-product-validation-"));
  try {
    const recorder = new ProductValidationRecorder({
      runRoot,
      scenario: "startup-success",
      mode: "devdeck-current",
      fixtureDir: process.cwd(),
    });

    await recorder.init();
    await recorder.runObservedCommand({
      id: "visible",
      command: "node -e \"console.log('visible')\"",
      commandLabel: "visible",
      category: "state",
    });
    await recorder.runObservedCommand({
      id: "hidden",
      command: "node -e \"console.log('hidden')\"",
      commandLabel: "npx devdeck logs api --tail 120",
      category: "hidden-evaluator",
      recordTranscript: false,
      hidden: true,
      hiddenReason: "test artifact",
    });

    const result = await recorder.finalize();
    const transcript = await readFile(result.outputs.transcript, "utf8");
    const events = JSON.parse(await readFile(result.outputs.commandEvents, "utf8"));

    assert.match(transcript, /\$ visible/);
    assert.doesNotMatch(transcript, /hidden/);
    assert.equal(events.length, 2);
    assert.equal(events[1].hidden, true);
    assert.equal(result.metrics.totalToolCalls, 1);
    assert.equal(result.metrics.hiddenEvaluatorCommands, 1);
  } finally {
    await rm(runRoot, { recursive: true, force: true });
  }
});

test("product validation modes include devdeck-optimized", () => {
  assert.ok(supportedModes.includes("devdeck-optimized"));
});
