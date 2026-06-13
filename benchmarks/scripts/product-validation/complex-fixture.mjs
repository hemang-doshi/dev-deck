import path from "node:path";
import { mkdir } from "node:fs/promises";

import {
  cliDistPath,
  fileExists,
  fixturesRoot,
  quote,
  repoRoot,
  resultsRoot,
  runCommand,
  timestampId,
} from "../_shared.mjs";

export const fixtureName = "complex-saas-stack";
export const fixtureDir = path.join(fixturesRoot, fixtureName);
export const scenariosDir = path.join(fixtureDir, "scenarios");
export const productValidationResultsRoot = path.join(resultsRoot, "product-validation");

export const supportedModes = [
  "manual-runtime",
  "devdeck-current",
];

export const supportedScenarios = [
  "startup-success",
  "missing-env",
  "port-conflict",
  "api-crash-after-start",
  "noisy-worker",
];

export const serviceStartOrder = [
  { serviceName: "postgres", scriptName: "start:postgres" },
  { serviceName: "redis", scriptName: "start:redis" },
  { serviceName: "mock-external-api", scriptName: "start:mock-external-api" },
  { serviceName: "api", scriptName: "start:api" },
  { serviceName: "worker", scriptName: "start:worker" },
  { serviceName: "scheduler", scriptName: "start:scheduler" },
  { serviceName: "web", scriptName: "start:web" },
];

export const serviceNames = serviceStartOrder.map(({ serviceName }) => serviceName);

export const runtimeManagementCategories = new Set([
  "scenario-setup",
  "startup",
  "state",
  "health-check",
  "logs",
  "process-management",
  "cleanup",
  "failure-observation",
]);

export function createProductValidationRunRoot(requestedRunRoot) {
  const runRoot = requestedRunRoot
    ? path.resolve(requestedRunRoot)
    : path.join(productValidationResultsRoot, timestampId());
  return mkdir(runRoot, { recursive: true }).then(() => runRoot);
}

export function getScenarioRunDirectory(runRoot, scenario, mode) {
  return path.join(runRoot, scenario, mode);
}

export async function loadScenarioDefinition(scenario) {
  const scenarioPath = path.join(scenariosDir, `${scenario}.json`);
  if (!(await fileExists(scenarioPath))) {
    throw new Error(`Unknown scenario '${scenario}'. Expected one of: ${supportedScenarios.join(", ")}`);
  }

  const source = await import("node:fs/promises").then(({ readFile }) => readFile(scenarioPath, "utf8"));
  return JSON.parse(source);
}

export function assertSupportedScenario(scenario) {
  if (!supportedScenarios.includes(scenario)) {
    throw new Error(`Unsupported scenario '${scenario}'. Expected one of: ${supportedScenarios.join(", ")}`);
  }
}

export function assertSupportedMode(mode) {
  if (!supportedModes.includes(mode)) {
    throw new Error(`Unsupported mode '${mode}'. Expected one of: ${supportedModes.join(", ")}`);
  }
}

export function defaultDevDeckCommand(suffix) {
  return `node ${quote(cliDistPath)} ${suffix}`;
}

export async function ensureDevDeckCliBuilt() {
  if (await fileExists(cliDistPath)) {
    return;
  }

  await runCommand("npm run build --workspace @hemangdoshi/devdeck", {
    cwd: repoRoot,
  });
}

export function parseProductValidationArgs(argv) {
  const args = [...argv];
  const scenario = args.find((arg) => !arg.startsWith("--")) ?? null;
  let mode = null;
  let runRoot = null;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--mode") {
      mode = args[index + 1] ?? null;
    }
    if (arg === "--run-root") {
      runRoot = args[index + 1] ?? null;
    }
  }

  return { scenario, mode, runRoot };
}
