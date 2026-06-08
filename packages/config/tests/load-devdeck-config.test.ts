import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  ConfigError,
  findDevdeckConfigPath,
  loadDevdeckConfig,
} from "../src/index.js";

const tempDirectories: string[] = [];

describe("loadDevdeckConfig", () => {
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
    const nestedDirectory = path.join(workspaceDirectory, "frontend", "src");

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
    expect(loaded.config.services.web).toMatchObject({
      name: "web",
      command: "npm run dev",
      cwd: "./frontend",
      resolvedCwd: path.join(workspaceDirectory, "frontend"),
      group: "frontend",
      port: 3000,
      legacyPort: 3000,
    });
  });

  it("loads existing v1 config with caller-compatible service fields", async () => {
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

    expect(loaded.config).toMatchObject({
      version: 2,
      project: "sample-app",
      services: {
        web: {
          name: "web",
          command: "npm run dev",
          cwd: "./frontend",
          resolvedCwd: path.join(workspaceDirectory, "frontend"),
          dependsOn: {},
          envFiles: [],
          requiredEnv: [],
          restartPolicy: { mode: "never" },
          links: [],
        },
      },
    });
  });

  it("normalizes v1 port into health link and legacyPort", async () => {
    const workspaceDirectory = await createWorkspace();

    await writeConfig(
      workspaceDirectory,
      [
        "project: sample-app",
        "services:",
        "  web:",
        "    command: npm run dev",
        "    cwd: .",
        "    port: 3000",
      ].join("\n"),
    );

    const loaded = await loadDevdeckConfig(workspaceDirectory);

    expect(loaded.config.services.web).toMatchObject({
      port: 3000,
      legacyPort: 3000,
      health: { type: "tcp", host: "127.0.0.1", port: 3000 },
      links: [{ label: "web", url: "http://127.0.0.1:3000" }],
    });
  });

  it("loads minimum v2 config", async () => {
    const workspaceDirectory = await createWorkspace();

    await writeConfig(
      workspaceDirectory,
      [
        "version: 2",
        "project: sample-app",
        "services:",
        "  web:",
        "    command: npm run dev",
        "    cwd: .",
      ].join("\n"),
    );

    const loaded = await loadDevdeckConfig(workspaceDirectory);

    expect(loaded.config).toMatchObject({
      version: 2,
      project: "sample-app",
      services: {
        web: {
          command: "npm run dev",
          cwd: ".",
          resolvedCwd: workspaceDirectory,
        },
      },
    });
  });

  it("loads v2 command service", async () => {
    const workspaceDirectory = await createWorkspace();

    await writeConfig(
      workspaceDirectory,
      v2Config([
        "  web:",
        "    command: npm run dev",
        "    cwd: .",
      ]),
    );

    await expect(loadDevdeckConfig(workspaceDirectory)).resolves.toMatchObject({
      config: { services: { web: { command: "npm run dev" } } },
    });
  });

  it("loads v2 exec.argv service", async () => {
    const workspaceDirectory = await createWorkspace();

    await writeConfig(
      workspaceDirectory,
      v2Config([
        "  web:",
        "    exec:",
        "      argv: [npm, run, dev]",
        "    cwd: .",
      ]),
    );

    const loaded = await loadDevdeckConfig(workspaceDirectory);

    expect(loaded.config.services.web).toMatchObject({
      exec: { argv: ["npm", "run", "dev"] },
    });
    expect(loaded.config.services.web?.command).toBeUndefined();
  });

  it("rejects command and exec together", async () => {
    const workspaceDirectory = await createWorkspace();

    await writeConfig(
      workspaceDirectory,
      v2Config([
        "  web:",
        "    command: npm run dev",
        "    exec:",
        "      argv: [npm, run, dev]",
        "    cwd: .",
      ]),
    );

    await expectConfigErrorCode(workspaceDirectory, "DD_CONFIG_COMMAND_INVALID");
  });

  it("rejects service with neither command nor exec", async () => {
    const workspaceDirectory = await createWorkspace();

    await writeConfig(
      workspaceDirectory,
      v2Config([
        "  web:",
        "    cwd: .",
      ]),
    );

    await expectConfigErrorCode(workspaceDirectory, "DD_CONFIG_COMMAND_INVALID");
  });

  it("normalizes dependsOn array", async () => {
    const workspaceDirectory = await createWorkspace();

    await writeConfig(
      workspaceDirectory,
      v2Config([
        "  db:",
        "    command: npm run db",
        "    cwd: .",
        "  web:",
        "    command: npm run dev",
        "    cwd: .",
        "    dependsOn:",
        "      - db",
      ]),
    );

    const loaded = await loadDevdeckConfig(workspaceDirectory);

    expect(loaded.config.services.web?.dependsOn).toEqual({
      db: { condition: "started" },
    });
  });

  it("normalizes dependsOn object", async () => {
    const workspaceDirectory = await createWorkspace();

    await writeConfig(
      workspaceDirectory,
      v2Config([
        "  db:",
        "    command: npm run db",
        "    cwd: .",
        "  web:",
        "    command: npm run dev",
        "    cwd: .",
        "    dependsOn:",
        "      db:",
        "        condition: healthy",
      ]),
    );

    const loaded = await loadDevdeckConfig(workspaceDirectory);

    expect(loaded.config.services.web?.dependsOn).toEqual({
      db: { condition: "healthy" },
    });
  });

  it("rejects unknown dependency", async () => {
    const workspaceDirectory = await createWorkspace();

    await writeConfig(
      workspaceDirectory,
      v2Config([
        "  web:",
        "    command: npm run dev",
        "    cwd: .",
        "    dependsOn:",
        "      - db",
      ]),
    );

    await expectConfigErrorCode(
      workspaceDirectory,
      "DD_CONFIG_DEPENDENCY_UNKNOWN",
    );
  });

  it("rejects dependency cycle", async () => {
    const workspaceDirectory = await createWorkspace();

    await writeConfig(
      workspaceDirectory,
      v2Config([
        "  api:",
        "    command: npm run api",
        "    cwd: .",
        "    dependsOn:",
        "      - web",
        "  web:",
        "    command: npm run dev",
        "    cwd: .",
        "    dependsOn:",
        "      - api",
      ]),
    );

    await expectConfigErrorCode(workspaceDirectory, "DD_CONFIG_DEPENDENCY_CYCLE");
  });

  it("rejects self dependency", async () => {
    const workspaceDirectory = await createWorkspace();

    await writeConfig(
      workspaceDirectory,
      v2Config([
        "  web:",
        "    command: npm run dev",
        "    cwd: .",
        "    dependsOn:",
        "      - web",
      ]),
    );

    await expectConfigErrorCode(workspaceDirectory, "DD_CONFIG_DEPENDENCY_SELF");
  });

  it("rejects invalid dependency condition", async () => {
    const workspaceDirectory = await createWorkspace();

    await writeConfig(
      workspaceDirectory,
      v2Config([
        "  db:",
        "    command: npm run db",
        "    cwd: .",
        "  web:",
        "    command: npm run dev",
        "    cwd: .",
        "    dependsOn:",
        "      db:",
        "        condition: warm",
      ]),
    );

    await expectConfigErrorCode(
      workspaceDirectory,
      "DD_CONFIG_DEPENDENCY_CONDITION_INVALID",
    );
  });

  it("validates tcp http and command health", async () => {
    const workspaceDirectory = await createWorkspace();

    await writeConfig(
      workspaceDirectory,
      v2Config([
        "  db:",
        "    command: npm run db",
        "    cwd: .",
        "    health:",
        "      type: tcp",
        "      host: 127.0.0.1",
        "      port: 5432",
        "      timeoutMs: 1000",
        "  api:",
        "    command: npm run api",
        "    cwd: .",
        "    health:",
        "      type: http",
        "      url: http://127.0.0.1:4000/health",
        "      expectedStatus: 204",
        "  worker:",
        "    command: npm run worker",
        "    cwd: .",
        "    health:",
        "      type: command",
        "      command: npm run healthcheck",
      ]),
    );

    const loaded = await loadDevdeckConfig(workspaceDirectory);

    expect(loaded.config.services.db?.health).toEqual({
      type: "tcp",
      host: "127.0.0.1",
      port: 5432,
      timeoutMs: 1000,
    });
    expect(loaded.config.services.api?.health).toEqual({
      type: "http",
      url: "http://127.0.0.1:4000/health",
      expectedStatus: 204,
    });
    expect(loaded.config.services.worker?.health).toEqual({
      type: "command",
      command: "npm run healthcheck",
    });
  });

  it("validates log http and tcp readiness", async () => {
    const workspaceDirectory = await createWorkspace();

    await writeConfig(
      workspaceDirectory,
      v2Config([
        "  api:",
        "    command: npm run api",
        "    cwd: .",
        "    readiness:",
        "      type: log",
        "      pattern: server listening",
        "  web:",
        "    command: npm run dev",
        "    cwd: .",
        "    readiness:",
        "      type: http",
        "      url: http://127.0.0.1:3000",
        "      expectedStatus: 200",
        "  db:",
        "    command: npm run db",
        "    cwd: .",
        "    readiness:",
        "      type: tcp",
        "      port: 5432",
        "      timeoutMs: 1000",
      ]),
    );

    const loaded = await loadDevdeckConfig(workspaceDirectory);

    expect(loaded.config.services.api?.readiness).toEqual({
      type: "log",
      pattern: "server listening",
    });
    expect(loaded.config.services.web?.readiness).toEqual({
      type: "http",
      url: "http://127.0.0.1:3000",
      expectedStatus: 200,
    });
    expect(loaded.config.services.db?.readiness).toEqual({
      type: "tcp",
      port: 5432,
      timeoutMs: 1000,
    });
  });

  it("normalizes restartPolicy default never", async () => {
    const workspaceDirectory = await createWorkspace();

    await writeConfig(
      workspaceDirectory,
      v2Config([
        "  web:",
        "    command: npm run dev",
        "    cwd: .",
      ]),
    );

    const loaded = await loadDevdeckConfig(workspaceDirectory);

    expect(loaded.config.services.web?.restartPolicy).toEqual({ mode: "never" });
  });

  it("validates restartPolicy on-failure options", async () => {
    const workspaceDirectory = await createWorkspace();

    await writeConfig(
      workspaceDirectory,
      v2Config([
        "  web:",
        "    command: npm run dev",
        "    cwd: .",
        "    restartPolicy:",
        "      mode: on-failure",
        "      maxRestarts: 3",
        "      delayMs: 0",
      ]),
    );

    const loaded = await loadDevdeckConfig(workspaceDirectory);

    expect(loaded.config.services.web?.restartPolicy).toEqual({
      mode: "on-failure",
      maxRestarts: 3,
      delayMs: 0,
    });
  });

  it("validates stop command and timeout", async () => {
    const workspaceDirectory = await createWorkspace();

    await writeConfig(
      workspaceDirectory,
      v2Config([
        "  db:",
        "    command: npm run db",
        "    cwd: .",
        "    stop:",
        "      command: docker compose stop db",
        "      timeoutMs: 15000",
      ]),
    );

    const loaded = await loadDevdeckConfig(workspaceDirectory);

    expect(loaded.config.services.db?.stop).toEqual({
      command: "docker compose stop db",
      timeoutMs: 15000,
    });
  });

  it("validates envFiles and requiredEnv arrays", async () => {
    const workspaceDirectory = await createWorkspace();

    await writeConfig(
      workspaceDirectory,
      v2Config([
        "  api:",
        "    command: npm run api",
        "    cwd: .",
        "    envFiles:",
        "      - .env",
        "    requiredEnv:",
        "      - DATABASE_URL",
      ]),
    );

    const loaded = await loadDevdeckConfig(workspaceDirectory);

    expect(loaded.config.services.api).toMatchObject({
      envFiles: [".env"],
      requiredEnv: ["DATABASE_URL"],
    });
  });

  it("validates links", async () => {
    const workspaceDirectory = await createWorkspace();

    await writeConfig(
      workspaceDirectory,
      v2Config([
        "  web:",
        "    command: npm run dev",
        "    cwd: .",
        "    links:",
        "      - label: App",
        "        url: http://127.0.0.1:3000",
      ]),
    );

    const loaded = await loadDevdeckConfig(workspaceDirectory);

    expect(loaded.config.services.web?.links).toEqual([
      { label: "App", url: "http://127.0.0.1:3000" },
    ]);
  });

  it("preserves cwd existence validation", async () => {
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

  it("preserves duplicate service name validation", async () => {
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

    await expect(loadDevdeckConfig(workspaceDirectory)).rejects.toThrow(
      ConfigError,
    );
  });
});

async function createWorkspace(): Promise<string> {
  const workspaceDirectory = await mkdtemp(
    path.join(os.tmpdir(), "devdeck-config-"),
  );

  await mkdir(path.join(workspaceDirectory, "frontend"), { recursive: true });

  tempDirectories.push(workspaceDirectory);

  return workspaceDirectory;
}

async function writeConfig(
  workspaceDirectory: string,
  source: string,
): Promise<void> {
  await writeFile(
    path.join(workspaceDirectory, "devdeck.yml"),
    `${source}\n`,
    "utf8",
  );
}

function v2Config(serviceLines: string[]): string {
  return ["version: 2", "project: sample-app", "services:", ...serviceLines].join(
    "\n",
  );
}

async function expectConfigErrorCode(
  workspaceDirectory: string,
  code: string,
): Promise<void> {
  try {
    await loadDevdeckConfig(workspaceDirectory);
    throw new Error("Expected loadDevdeckConfig to fail");
  } catch (error) {
    expect(error).toBeInstanceOf(ConfigError);
    expect((error as ConfigError).code).toBe(code);
  }
}
