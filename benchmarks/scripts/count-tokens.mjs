import path from "node:path";
import { readFile } from "node:fs/promises";

import {
  listRunModes,
  parseRunDirArgument,
  writeCommandAttribution,
  writeJson,
} from "./_shared.mjs";
import {
  countTextWithTokenizers,
  getTokenizerConfiguration,
} from "./tokenizers.mjs";

function savingsPercent(baselineTokens, comparedTokens) {
  return baselineTokens === 0
    ? 0
    : Number((((baselineTokens - comparedTokens) / baselineTokens) * 100).toFixed(2));
}

export async function countTokens(runDir, options = {}) {
  if (!runDir) {
    throw new Error("Usage: node benchmarks/scripts/count-tokens.mjs <results-dir>");
  }

  const modeNames = await listRunModes(runDir);
  if (modeNames.length === 0) {
    throw new Error(`No mode transcripts found in ${runDir}.`);
  }

  const { primaryTokenizer, tokenizers } = getTokenizerConfiguration(options);
  const tokenizerResults = Object.fromEntries(
    tokenizers.map((tokenizer) => [
      tokenizer,
      {
        ...(tokenizer === "approx-char-div-4"
          ? { formula: "ceil(character_count / 4)" }
          : {}),
        modes: {},
        comparisons: {},
      },
    ]),
  );
  const countedFiles = {};
  for (const mode of modeNames) {
    const relativeTranscriptPath = `${mode}/transcript.txt`;
    const transcript = await readFile(path.join(runDir, relativeTranscriptPath), "utf8");
    const count = await countTextWithTokenizers(transcript, { tokenizers });
    for (const tokenizer of tokenizers) {
      tokenizerResults[tokenizer].modes[mode] = {
        characters: count.characters,
        tokens: count.tokens[tokenizer],
      };
    }
    countedFiles[mode] = [relativeTranscriptPath];
  }

  for (const tokenizer of tokenizers) {
    const tokenizerResult = tokenizerResults[tokenizer];
    const baseline = tokenizerResult.modes.baseline;
    if (!baseline) continue;

    for (const [mode, values] of Object.entries(tokenizerResult.modes)) {
      if (mode !== "baseline") {
        tokenizerResult.comparisons[`${mode}-vs-baseline`] = {
          savingsPercent: savingsPercent(baseline.tokens, values.tokens),
        };
      }
    }
  }

  const primary = tokenizerResults[primaryTokenizer];
  const approximate = tokenizerResults["approx-char-div-4"];
  const modes = Object.fromEntries(
    Object.entries(primary.modes).map(([mode, values]) => [
      mode,
      {
        ...values,
        primaryTokens: values.tokens,
        approxTokens: approximate?.modes[mode]?.tokens ?? null,
      },
    ]),
  );
  const result = {
    primaryTokenizer,
    tokenizers: tokenizerResults,
    countedFiles,
    modes,
    comparisons: primary.comparisons,
    caveat: "Local tokenizer counts. Provider-reported usage may differ for live agent runs.",
  };

  if (modes.baseline && modes.devdeck) {
    result.baseline = modes.baseline;
    result.devdeck = modes.devdeck;
    result.savingsPercent = primary.comparisons["devdeck-vs-baseline"].savingsPercent;
  }

  await writeJson(path.join(runDir, "token-count.json"), result);
  await writeCommandAttribution(runDir, modeNames, { primaryTokenizer, tokenizers });
  return result;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const runDir = parseRunDirArgument(process.argv.slice(2));
  const result = await countTokens(runDir ? path.resolve(runDir) : undefined);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
