import path from "node:path";
import { readFile } from "node:fs/promises";

import { parseRunDirArgument, writeJson } from "./_shared.mjs";

function approximateTokens(characters) {
  return Math.ceil(characters / 4);
}

export async function countTokens(runDir) {
  if (!runDir) {
    throw new Error("Usage: node benchmarks/scripts/count-tokens.mjs <results-dir>");
  }

  const baselineTranscript = await readFile(path.join(runDir, "baseline/transcript.txt"), "utf8");
  const devdeckTranscript = await readFile(path.join(runDir, "devdeck/transcript.txt"), "utf8");

  const baselineCharacters = baselineTranscript.length;
  const devdeckCharacters = devdeckTranscript.length;
  const baselineTokens = approximateTokens(baselineCharacters);
  const devdeckTokens = approximateTokens(devdeckCharacters);
  const savingsPercent = baselineTokens === 0
    ? 0
    : Number((((baselineTokens - devdeckTokens) / baselineTokens) * 100).toFixed(2));

  const result = {
    tokenizer: "approx-char-div-4",
    baseline: {
      characters: baselineCharacters,
      approxTokens: baselineTokens,
    },
    devdeck: {
      characters: devdeckCharacters,
      approxTokens: devdeckTokens,
    },
    savingsPercent,
  };

  await writeJson(path.join(runDir, "token-count.json"), result);
  return result;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const runDir = parseRunDirArgument(process.argv.slice(2));
  const result = await countTokens(runDir ? path.resolve(runDir) : undefined);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
