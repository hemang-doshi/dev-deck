import { createRunDirectory } from "./_shared.mjs";
import { countTokens } from "./count-tokens.mjs";
import { runBaseline } from "./run-baseline.mjs";
import { runDevDeck } from "./run-devdeck.mjs";
import { summarizeResults } from "./summarize-results.mjs";

const runDir = await createRunDirectory();

await runBaseline({ runDir });
await runDevDeck({ runDir });
await countTokens(runDir);
const summaryPath = await summarizeResults(runDir);

process.stdout.write(`Benchmark run complete.\nResults: ${runDir}\nSummary: ${summaryPath}\n`);
