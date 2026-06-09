import { access, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { runDevCommand } from "../src/commands/dev.js";
import { readSessionState } from "../src/session-state.js";

describe("runDevCommand", () => {
  const tempDirectories: string[] = [];

  afterEach(async () => {
    for (const directory of tempDirectories) {
      await removeWorkspace(directory);
    }
    tempDirectories.length = 0;
  });

  it("prints parsed service information from the config", async () => {
    const workspaceDirectory = await createWorkspace(tempDirectories);
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
        "",
      ].join("\n"),
      "utf8",
    );

    await runDevCommand({
      cwd: workspaceDirectory,
      holdUntilSignal: false,
      port: 0,
      io: {
        stdout: (message) => stdout.push(message),
        stderr: () => undefined,
      },
    });

    expect(stdout.join("")).toContain("Project: my-app");
    expect(stdout.join("")).toContain("- web: node -e \"console.log('ready')\" | cwd=");
    expect(stdout.join("")).toContain("[web:stdout] ready");
  });

  it("uses the requested port and cleans up the runtime session file", async () => {
    const workspaceDirectory = await createWorkspace(tempDirectories);
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
        "",
      ].join("\n"),
      "utf8",
    );

    await runDevCommand({
      cwd: workspaceDirectory,
      holdUntilSignal: false,
      port: 5656,
      io: {
        stdout: (message) => stdout.push(message),
        stderr: () => undefined,
      },
      onServerStarted: async () => {
        await expect(readSessionState(workspaceDirectory)).resolves.toMatchObject({
          port: 5656,
          project: "my-app",
          url: "http://127.0.0.1:5656",
        });
      },
    });

    expect(stdout.join("")).toContain("Dashboard: http://127.0.0.1:5656");
    await expect(access(path.join(workspaceDirectory, ".devdeck/session.json"))).rejects.toMatchObject(
      {
        code: "ENOENT",
      },
    );
  });

  it("passes v2 exec.argv and envFiles into runtime services without printing env values", async () => {
    const workspaceDirectory = await createWorkspace(tempDirectories);
    const frontendDirectory = path.join(workspaceDirectory, "frontend");
    const stdout: string[] = [];

    await mkdir(frontendDirectory, { recursive: true });
    await writeFile(path.join(workspaceDirectory, ".env"), "DATABASE_URL=postgres://secret\n", "utf8");
    await writeFile(
      path.join(workspaceDirectory, "devdeck.yml"),
      [
        "version: 2",
        "project: my-app",
        "services:",
        "  web:",
        "    exec:",
        "      argv:",
        "        - node",
        "        - -e",
        "        - \"console.log(process.env.DATABASE_URL ? 'env-ok' : 'env-missing')\"",
        "    cwd: ./frontend",
        "    envFiles:",
        "      - .env",
        "    requiredEnv:",
        "      - DATABASE_URL",
        "",
      ].join("\n"),
      "utf8",
    );

    await runDevCommand({
      cwd: workspaceDirectory,
      holdUntilSignal: false,
      port: 0,
      io: {
        stdout: (message) => stdout.push(message),
        stderr: () => undefined,
      },
    });

    const output = stdout.join("");
    expect(output).toContain("exec ");
    expect(output).toContain("[web:stdout] env-ok");
    expect(output).not.toContain("postgres://secret");
  });
});

async function createWorkspace(tempDirectories: string[]): Promise<string> {
  const root = path.resolve(process.cwd(), "../../.devdeck/cli-dev-tests");
  await mkdir(root, { recursive: true });
  const workspaceDirectory = await mkdtemp(path.join(root, "workspace-"));
  tempDirectories.push(workspaceDirectory);
  return workspaceDirectory;
}

async function removeWorkspace(directory: string): Promise<void> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      await rm(directory, { recursive: true, force: true });
      return;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;

      if (code !== "EBUSY" && code !== "ENOTEMPTY" && code !== "EPERM") {
        throw error;
      }

      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  await rm(directory, { recursive: true, force: true });
}
