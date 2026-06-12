export const scenarioDefinitions = {
  "happy-path": {
    description: "Happy-path startup and routine service inspection.",
    measures: "Orchestration and observation overhead when all services remain healthy.",
  },
  "noisy-worker": {
    description: "A healthy stack with frequent deterministic worker logs.",
    measures: "Context growth and targeted inspection cost under noisy long-running logs.",
  },
  "api-crash": {
    description: "The API exits after startup with a deterministic runtime error.",
    measures: "Runtime failure diagnosis after a service crashes post-startup.",
  },
};

export const supportedModes = [
  "baseline",
  "devdeck-full",
  "devdeck-status-only",
  "devdeck-snapshot-only",
  "devdeck-logs-only",
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
