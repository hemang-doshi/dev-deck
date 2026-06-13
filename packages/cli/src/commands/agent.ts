import type { CommandIo } from "./init.js";

export async function runAgentCommand(args: string[], io: CommandIo = defaultIo): Promise<void> {
  if (args[0] !== "setup") {
    throw new Error("Usage: devdeck agent setup");
  }

  io.stdout(`${buildAgentSetupOutput()}\n`);
}

function buildAgentSetupOutput(): string {
  return [
    "# DevDeck Setup",
    "",
    "Use DevDeck as the local control plane for your repository.",
    "1. Inspect the repo and identify the services that should start together.",
    "2. Create or update `devdeck.yml` so each service has a command and cwd.",
    "3. Use `devdeck dev` to start everything, then use `devdeck status`, `devdeck logs`, and `devdeck snapshot` for bounded debugging.",
    "",
    "Starter template:",
    "```yaml",
    "project: my-app",
    "services:",
    "  api:",
    "    command: npm run dev",
    "    cwd: ./apps/api",
    "  worker:",
    "    command: npm run worker",
    "    cwd: ./apps/worker",
    "```",
    "",
    "Use `devdeck dev` after the file is ready.",
  ].join("\n");
}

const defaultIo: CommandIo = {
  stdout: (message) => process.stdout.write(message),
  stderr: (message) => process.stderr.write(message),
};
