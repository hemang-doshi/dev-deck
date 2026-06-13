import path from "node:path";

import { writeJson } from "./_shared.mjs";
import { runDevDeckCurrentMode } from "./product-validation/devdeck-current-mode.mjs";
import { runDevDeckOptimizedMode } from "./product-validation/devdeck-optimized-mode.mjs";
import { evaluateProductValidationRun } from "./product-validation/evaluate-product-validation.mjs";
import {
  assertSupportedMode,
  assertSupportedScenario,
  createProductValidationRunRoot,
  parseProductValidationArgs,
} from "./product-validation/complex-fixture.mjs";
import { runManualRuntimeMode } from "./product-validation/manual-runtime-mode.mjs";

const runners = {
  "manual-runtime": runManualRuntimeMode,
  "devdeck-current": runDevDeckCurrentMode,
  "devdeck-optimized": runDevDeckOptimizedMode,
};

export async function runProductValidation({ scenario, mode, runRoot }) {
  assertSupportedScenario(scenario);
  assertSupportedMode(mode);
  const resolvedRunRoot = await createProductValidationRunRoot(runRoot);
  const runData = await runners[mode]({ scenario, runRoot: resolvedRunRoot });
  const modeDir = path.join(resolvedRunRoot, scenario, mode);
  const evaluation = await evaluateProductValidationRun(modeDir);

  await writeJson(path.join(modeDir, "run.json"), {
    ...runData,
    timing: evaluation.actual.timing,
    evaluation: {
      passed: evaluation.passed,
      failureReason: evaluation.failureReason,
    },
  });

  return {
    runRoot: resolvedRunRoot,
    modeDir,
    runData,
    evaluation,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { scenario, mode, runRoot } = parseProductValidationArgs(process.argv.slice(2));

  if (!scenario || !mode) {
    process.stderr.write(
      "Usage: node benchmarks/scripts/run-product-validation.mjs <scenario> --mode <manual-runtime|devdeck-current|devdeck-optimized> [--run-root <path>]\n",
    );
    process.exit(1);
  }

  const result = await runProductValidation({ scenario, mode, runRoot });
  process.stdout.write(`${result.modeDir}\n`);
}
