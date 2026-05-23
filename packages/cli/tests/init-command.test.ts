import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { runInitCommand } from "../src/commands/init.js";

const tempDirectories: string[] = [];

describe("runInitCommand", () => {
  afterEach(async () => {
    await Promise.all(
      tempDirectories.map((directory) => rm(directory, { recursive: true, force: true })),
    );
    tempDirectories.length = 0;
  });

  it("creates a starter devdeck.yml file", async () => {
    const workspaceDirectory = await createWorkspace();
    const stdout: string[] = [];

    await runInitCommand({
      cwd: workspaceDirectory,
      io: {
        stdout: (message) => stdout.push(message),
        stderr: () => undefined,
      },
    });

    const configPath = path.join(workspaceDirectory, "devdeck.yml");
    const configSource = await readFile(configPath, "utf8");

    expect(configSource).toContain("project: my-app");
    expect(configSource).toContain("services:");
    expect(stdout.join("")).toContain(`Created ${configPath}`);
  });

  it("fails when devdeck.yml already exists", async () => {
    const workspaceDirectory = await createWorkspace();

    await runInitCommand({
      cwd: workspaceDirectory,
      io: {
        stdout: () => undefined,
        stderr: () => undefined,
      },
    });

    await expect(runInitCommand({ cwd: workspaceDirectory })).rejects.toThrow(
      "devdeck.yml already exists",
    );

    await expect(access(path.join(workspaceDirectory, "devdeck.yml"))).resolves.toBeUndefined();
  });
});

async function createWorkspace(): Promise<string> {
  const workspaceDirectory = await mkdtemp(path.join(os.tmpdir(), "devdeck-cli-init-"));
  tempDirectories.push(workspaceDirectory);
  return workspaceDirectory;
}
