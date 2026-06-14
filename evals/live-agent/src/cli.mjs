#!/usr/bin/env node

import { runLiveAgentEvaluation } from "./runner.mjs";

function parseArguments(argv) {
  let mode = "smoke";
  let scenario;
  let repeats = 1;

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--mode") {
      mode = argv[index + 1];
      index += 1;
      continue;
    }
    if (value === "--scenario") {
      scenario = argv[index + 1];
      index += 1;
      continue;
    }
    if (value === "--repeats") {
      repeats = Number(argv[index + 1]);
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${value}`);
  }

  if (!["smoke", "codex"].includes(mode)) {
    throw new Error(`Unsupported mode '${mode}'. Expected smoke or codex.`);
  }
  if (!Number.isInteger(repeats) || repeats < 1) {
    throw new Error(`Unsupported repeats '${repeats}'. Expected an integer >= 1.`);
  }

  return { mode, scenario, repeats };
}

const options = parseArguments(process.argv.slice(2));
const result = await runLiveAgentEvaluation(options);

if (result.skipped) {
  process.stdout.write(`Live Codex eval skipped.\nRun: ${result.runDir}\nReport: ${result.reportDir}\nReason: ${result.reason}\n`);
} else {
  const reportLine = result.reportDir ? `\nReport: ${result.reportDir}` : "";
  process.stdout.write(`Live agent evaluation complete.\nRun: ${result.runDir}${reportLine}\n`);
}
