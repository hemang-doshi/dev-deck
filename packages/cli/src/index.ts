#!/usr/bin/env node

import { ConfigError } from "@devdeck/config";

import { runDevCommand } from "./commands/dev.js";
import { runInitCommand } from "./commands/init.js";

type CommandName = "init" | "dev";

export async function runCli(argv: string[]): Promise<number> {
  const command = argv[0] as CommandName | undefined;

  if (!command) {
    process.stderr.write("Usage: devdeck <init|dev>\n");
    return 1;
  }

  try {
    if (command === "init") {
      await runInitCommand();
      return 0;
    }

    if (command === "dev") {
      await runDevCommand();
      return 0;
    }

    process.stderr.write(`Unknown command: ${command}\n`);
    process.stderr.write("Usage: devdeck <init|dev>\n");
    return 1;
  } catch (error) {
    if (error instanceof ConfigError || error instanceof Error) {
      process.stderr.write(`${error.message}\n`);
      return 1;
    }

    process.stderr.write("Unexpected error\n");
    return 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const exitCode = await runCli(process.argv.slice(2));
  process.exit(exitCode);
}
