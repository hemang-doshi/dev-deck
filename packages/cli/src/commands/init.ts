import { access, writeFile } from "node:fs/promises";
import path from "node:path";

export type CommandIo = {
  stdout: (message: string) => void;
  stderr: (message: string) => void;
};

export type InitCommandOptions = {
  cwd?: string;
  io?: CommandIo;
};

export async function runInitCommand(options: InitCommandOptions = {}): Promise<void> {
  const cwd = path.resolve(options.cwd ?? process.cwd());
  const io = options.io ?? defaultIo;
  const configPath = path.join(cwd, "devdeck.yml");

  try {
    await access(configPath);
    throw new Error(`devdeck.yml already exists at ${configPath}.`);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }

  await writeFile(configPath, createStarterConfig(), "utf8");
  io.stdout(`Created ${configPath}\n`);
}

export function createStarterConfig(): string {
  return [
    "project: my-app",
    "services:",
    "  web:",
    "    command: npm run dev",
    "    cwd: ./frontend",
    "    port: 3000",
    "",
  ].join("\n");
}

const defaultIo: CommandIo = {
  stdout: (message) => process.stdout.write(message),
  stderr: (message) => process.stderr.write(message),
};
