import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const scenariosDirectory = path.resolve(__dirname, "../scenarios");

function loadScenarioDefinition(name) {
  return JSON.parse(
    readFileSync(path.join(scenariosDirectory, `${name}.json`), "utf8"),
  );
}

export const scenarioDefinitions = Object.fromEntries(
  ["happy-path", "noisy-worker", "api-crash"].map((name) => [
    name,
    loadScenarioDefinition(name),
  ]),
);

export const supportedModes = [
  "baseline",
  "devdeck-full",
  "devdeck-status-only",
  "devdeck-snapshot-only",
  "devdeck-logs-only",
  "devdeck-agent-status",
  "devdeck-agent-snapshot",
  "devdeck-agent-logs",
  "devdeck-agent-full",
];

export function getScenarioDefinition(name) {
  const definition = scenarioDefinitions[name];
  if (!definition) {
    throw new Error(
      `Unknown scenario '${name}'. Expected one of: ${Object.keys(scenarioDefinitions).join(", ")}.`,
    );
  }
  return definition;
}

export function assertSupportedMode(mode) {
  if (!supportedModes.includes(mode)) {
    throw new Error(`Unknown mode '${mode}'. Expected one of: ${supportedModes.join(", ")}.`);
  }
}
