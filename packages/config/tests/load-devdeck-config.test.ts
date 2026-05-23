import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { ConfigError, findDevdeckConfigPath, loadDevdeckConfig } from "../src/index.js";

describe("loadDevdeckConfig", () => {
  const tempDirectories: string[] = [];

  afterEach(async () => {
    await Promise.all(
      tempDirectories.map(async (directory) => {
        await import("node:fs/promises").then(({ rm }) =>
          rm(directory, { recursive: true, force: true }),
        );
      }),
    );
    tempDirectories.length = 0;
  });

  it("discovers devdeck.yml from a nested directory", async () => {
    const workspaceDirectory = await createWorkspace();
    const appDirectory = path.join(workspaceDirectory, "frontend");
    const nestedDirectory = path.join(appDirectory, "src");

    await mkdir(nestedDirectory, { recursive: true });
    await writeConfig(
      workspaceDirectory,
      [
        "project: sample-app",
        "services:",
        "  web:",
        "    command: npm run dev",
        "    cwd: ./frontend",
        "    group: frontend",
        "    port: 3000",
      ].join("\n"),
    );

    const configPath = await findDevdeckConfigPath(nestedDirectory);
    const loaded = await loadDevdeckConfig(nestedDirectory);

    expect(configPath).toBe(path.join(workspaceDirectory, "devdeck.yml"));
    expect(loaded.config.project).toBe("sample-app");
    expect(loaded.config.services.web).toEqual({
      command: "npm run dev",
      cwd: "./frontend",
      group: "frontend",
      port: 3000,
    });
  });

  it("accepts omitted service group fields", async () => {
    const workspaceDirectory = await createWorkspace();

    await writeConfig(
      workspaceDirectory,
      [
        "project: sample-app",
        "services:",
        "  web:",
        "    command: npm run dev",
        "    cwd: ./frontend",
      ].join("\n"),
    );

    const loaded = await loadDevdeckConfig(workspaceDirectory);

    expect(loaded.config.services.web).toEqual({
      command: "npm run dev",
      cwd: "./frontend",
    });
  });

  it("fails when service group is not a string", async () => {
    const workspaceDirectory = await createWorkspace();

    await writeConfig(
      workspaceDirectory,
      [
        "project: sample-app",
        "services:",
        "  web:",
        "    command: npm run dev",
        "    cwd: ./frontend",
        "    group: 123",
      ].join("\n"),
    );

    await expect(loadDevdeckConfig(workspaceDirectory)).rejects.toThrow(
      'Expected service "web" group to be a non-empty string',
    );
  });

  it("fails on invalid YAML", async () => {
    const workspaceDirectory = await createWorkspace();

    await writeConfig(
      workspaceDirectory,
      [
        "project: broken",
        "services:",
        "  web:",
        "    command: npm run dev",
        "    cwd: [",
      ].join("\n"),
    );

    await expect(loadDevdeckConfig(workspaceDirectory)).rejects.toThrow(ConfigError);
  });

  it("fails when required fields are missing", async () => {
    const workspaceDirectory = await createWorkspace();

    await writeConfig(
      workspaceDirectory,
      [
        "project: sample-app",
        "services:",
        "  web:",
        "    cwd: ./frontend",
      ].join("\n"),
    );

    await expect(loadDevdeckConfig(workspaceDirectory)).rejects.toThrow(
      'Expected service "web" to define a non-empty "command"',
    );
  });

  it("fails when service cwd does not exist", async () => {
    const workspaceDirectory = await createWorkspace();

    await writeConfig(
      workspaceDirectory,
      [
        "project: sample-app",
        "services:",
        "  web:",
        "    command: npm run dev",
        "    cwd: ./missing",
      ].join("\n"),
    );

    await expect(loadDevdeckConfig(workspaceDirectory)).rejects.toThrow(
      'Expected service "web" cwd to exist',
    );
  });

  it("fails on duplicate service names", async () => {
    const workspaceDirectory = await createWorkspace();

    await writeConfig(
      workspaceDirectory,
      [
        "project: sample-app",
        "services:",
        "  web:",
        "    command: npm run dev",
        "    cwd: ./frontend",
        "  web:",
        "    command: npm run api",
        "    cwd: ./frontend",
      ].join("\n"),
    );

    await expect(loadDevdeckConfig(workspaceDirectory)).rejects.toThrow(
      'Duplicate service name "web"',
    );
  });
});

async function createWorkspace(): Promise<string> {
  const workspaceDirectory = await mkdtemp(path.join(os.tmpdir(), "devdeck-config-"));

  await mkdir(path.join(workspaceDirectory, "frontend"), { recursive: true });

  return workspaceDirectory;
}

async function writeConfig(workspaceDirectory: string, source: string): Promise<void> {
  await writeFile(path.join(workspaceDirectory, "devdeck.yml"), `${source}\n`, "utf8");
}
