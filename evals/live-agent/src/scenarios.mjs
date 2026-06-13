import path from "node:path";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const scenariosDir = path.resolve(__dirname, "../scenarios");
const promptsDir = path.resolve(__dirname, "../prompts");

export const supportedVariants = ["baseline-shell", "devdeck-agent"];

export async function loadScenario(id) {
  const source = await readFile(path.join(scenariosDir, `${id}.json`), "utf8");
  return JSON.parse(source);
}

export async function listScenarios() {
  return await Promise.all(["api-crash", "noisy-worker"].map(loadScenario));
}

export async function loadPrompt(variant) {
  if (!supportedVariants.includes(variant)) {
    throw new Error(
      `Unsupported variant '${variant}'. Expected one of: ${supportedVariants.join(", ")}.`,
    );
  }
  return await readFile(path.join(promptsDir, `${variant}.md`), "utf8");
}

export function buildScenarioPrompt({ scenario, variant, workspacePath }) {
  const instructions = variant === "baseline-shell"
    ? "Use shell commands only."
    : "Use DevDeck-first commands and prefer compact agent output.";
  return `${instructions}

Scenario: ${scenario.id}
Description: ${scenario.description}
Goal: ${scenario.goal}
Workspace: ${workspacePath}

Expected verification target:
- final health output should include ${scenario.expected.finalHealthContains}

Service environment for this run:
${Object.entries(scenario.environment).map(([key, value]) => `- ${key}=${value}`).join("\n")}

Constraints:
- Maximum turns: ${scenario.limits.maxTurns}
- Maximum tool calls: ${scenario.limits.maxToolCalls}
- Keep commands bounded and deterministic.
- Treat the fixture as immutable. Do not edit source files or configuration files.
- Recovery must use runtime or service-management actions rather than code changes.
- Finish with the requested concise final answer fields only.
`;
}
