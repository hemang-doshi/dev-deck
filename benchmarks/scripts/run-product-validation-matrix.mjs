import { runProductValidation } from "./run-product-validation.mjs";
import {
  createProductValidationRunRoot,
  supportedModes,
  supportedScenarios,
} from "./product-validation/complex-fixture.mjs";
import { writeProductValidationSummary } from "./product-validation/summarize-product-validation.mjs";

export async function runProductValidationMatrix() {
  const runRoot = await createProductValidationRunRoot();
  const rows = [];

  for (const scenario of supportedScenarios) {
    for (const mode of supportedModes) {
      const result = await runProductValidation({ scenario, mode, runRoot });
      rows.push({
        runData: result.runData,
        evaluation: result.evaluation,
      });
    }
  }

  const summary = await writeProductValidationSummary(runRoot, rows);
  return {
    runRoot,
    ...summary,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = await runProductValidationMatrix();
  process.stdout.write(`${result.runRoot}\n`);
}
