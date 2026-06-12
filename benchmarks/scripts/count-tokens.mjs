import path from "node:path";
import { readFile } from "node:fs/promises";

import {
  approximateTokens,
  listRunModes,
  parseRunDirArgument,
  writeCommandAttribution,
  writeJson,
} from "./_shared.mjs";

export async function countTokens(runDir) {
  if (!runDir) {
    throw new Error("Usage: node benchmarks/scripts/count-tokens.mjs <results-dir>");
  }

  const modeNames = await listRunModes(runDir);
  if (modeNames.length === 0) {
    throw new Error(`No mode transcripts found in ${runDir}.`);
  }

  const modes = {};
  const countedFiles = {};
  for (const mode of modeNames) {
    const relativeTranscriptPath = `${mode}/transcript.txt`;
    const transcript = await readFile(path.join(runDir, relativeTranscriptPath), "utf8");
    modes[mode] = {
      characters: transcript.length,
      approxTokens: approximateTokens(transcript.length),
    };
    countedFiles[mode] = [relativeTranscriptPath];
  }

  const comparisons = {};
  const baseline = modes.baseline;
  if (baseline) {
    for (const [mode, values] of Object.entries(modes)) {
      if (mode === "baseline") continue;
      comparisons[`${mode}-vs-baseline`] = {
        savingsPercent: baseline.approxTokens === 0
          ? 0
          : Number(
              (
                ((baseline.approxTokens - values.approxTokens) / baseline.approxTokens) *
                100
              ).toFixed(2),
            ),
      };
    }
  }

  const result = {
    tokenizer: "approx-char-div-4",
    countedFiles,
    formula: "ceil(character_count / 4)",
    modes,
    comparisons,
    caveat: "Approximate token counting only. Not model-specific.",
  };

  if (modes.baseline && modes.devdeck) {
    result.baseline = modes.baseline;
    result.devdeck = modes.devdeck;
    result.savingsPercent = comparisons["devdeck-vs-baseline"].savingsPercent;
  }

  await writeJson(path.join(runDir, "token-count.json"), result);
  await writeCommandAttribution(runDir, modeNames);
  return result;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const runDir = parseRunDirArgument(process.argv.slice(2));
  const result = await countTokens(runDir ? path.resolve(runDir) : undefined);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
