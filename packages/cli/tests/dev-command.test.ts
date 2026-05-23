import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { runDevCommand } from "../src/commands/dev.js";

describe("runDevCommand", () => {
  const tempDirectories: string[] = [];

  afterEach(async () => {
    await Promise.all(
      tempDirectories.map((directory) => rm(directory, { recursive: true, force: true })),
    );
    tempDirectories.length = 0;
  });

  it("prints parsed service information from the config", async () => {
    const workspaceDirectory = await mkdtemp(path.join(os.tmpdir(), "devdeck-cli-dev-"));
    tempDirectories.push(workspaceDirectory);
    const frontendDirectory = path.join(workspaceDirectory, "frontend");
    const stdout: string[] = [];

    await mkdir(frontendDirectory, { recursive: true });
    await writeFile(
      path.join(workspaceDirectory, "devdeck.yml"),
      [
        "project: my-app",
        "services:",
        "  web:",
        "    command: node -e \"console.log('ready')\"",
        "    cwd: ./frontend",
        "    port: 3000",
        "",
      ].join("\n"),
      "utf8",
    );

    await runDevCommand({
      cwd: workspaceDirectory,
      holdUntilSignal: false,
      io: {
        stdout: (message) => stdout.push(message),
        stderr: () => undefined,
      },
    });

    expect(stdout.join("")).toContain("Project: my-app");
    expect(stdout.join("")).toContain("- web: node -e \"console.log('ready')\" | cwd=");
    expect(stdout.join("")).toContain("[web:stdout] ready");
  });
});
