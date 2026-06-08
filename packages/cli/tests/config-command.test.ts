import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { isCliEntrypoint, runCli } from "../src/index.js";

const tempDirectories: string[] = [];
const managedEnvKeys = [
  "DEVDECK_TEST_DATABASE_URL",
  "DEVDECK_TEST_API_KEY",
];
let previousEnv: Partial<Record<string, string | undefined>> = {};

describe("config command", () => {
  beforeEach(() => {
    previousEnv = {};

    for (const key of managedEnvKeys) {
      previousEnv[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(async () => {
    await Promise.all(
      tempDirectories.map((directory) => rm(directory, { recursive: true, force: true })),
    );
    tempDirectories.length = 0;

    for (const key of managedEnvKeys) {
      const value = previousEnv[key];

      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  it("validates v1 configs with a json response envelope", async () => {
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

    const result = await runWithCapturedIo(["config", "validate", "--json"], workspaceDirectory);
    const response = JSON.parse(result.stdout);

    expect(result).toMatchObject({ code: 0, stderr: "" });
    expect(response).toMatchObject({
      schemaVersion: "devdeck.response.v1",
      ok: true,
      command: "config.validate",
      project: "sample-app",
      result: {
        valid: true,
        version: 2,
        serviceCount: 1,
        findings: [],
      },
      error: null,
    });
    expect(response.result.configPath).toBe(path.join(workspaceDirectory, "devdeck.yml"));
  });

  it("validates v2 configs with dependencies and env from an env file", async () => {
    const workspaceDirectory = await createWorkspace(["apps/api", "apps/web"]);
    await writeFile(
      path.join(workspaceDirectory, ".env"),
      "DEVDECK_TEST_DATABASE_URL=postgres://localhost/sample\n",
      "utf8",
    );
    await writeConfig(
      workspaceDirectory,
      [
        "version: 2",
        "project: sample-app",
        "services:",
        "  api:",
        "    command: npm run api",
        "    cwd: ./apps/api",
        "    envFiles:",
        "      - .env",
        "    requiredEnv:",
        "      - DEVDECK_TEST_DATABASE_URL",
        "  web:",
        "    exec:",
        "      argv: [npm, run, dev]",
        "    cwd: ./apps/web",
        "    dependsOn:",
        "      api:",
        "        condition: ready",
      ].join("\n"),
    );

    const result = await runWithCapturedIo(["config", "validate", "--json"], workspaceDirectory);
    const response = JSON.parse(result.stdout);

    expect(result).toMatchObject({ code: 0, stderr: "" });
    expect(response).toMatchObject({
      ok: true,
      command: "config.validate",
      result: {
        valid: true,
        serviceCount: 2,
        findings: [],
      },
    });
  });

  it("validates required env from quoted env values with inline comments", async () => {
    const workspaceDirectory = await createWorkspace();
    await writeFile(
      path.join(workspaceDirectory, ".env"),
      [
        "# local development secrets",
        "DEVDECK_TEST_DATABASE_URL=\"postgres://localhost/sample\" # database connection",
        "DEVDECK_TEST_API_KEY='abc123' # api token",
      ].join("\n"),
      "utf8",
    );
    await writeConfig(
      workspaceDirectory,
      [
        "version: 2",
        "project: sample-app",
        "services:",
        "  api:",
        "    command: npm run api",
        "    cwd: .",
        "    envFiles:",
        "      - .env",
        "    requiredEnv:",
        "      - DEVDECK_TEST_DATABASE_URL",
        "      - DEVDECK_TEST_API_KEY",
      ].join("\n"),
    );

    const result = await runWithCapturedIo(["config", "validate", "--json"], workspaceDirectory);
    const response = JSON.parse(result.stdout);

    expect(result).toMatchObject({ code: 0, stderr: "" });
    expect(response.result.findings).toEqual([]);
    expect(result.stdout).not.toContain("postgres://localhost/sample");
    expect(result.stdout).not.toContain("abc123");
  });

  it("returns a structured json error for invalid YAML", async () => {
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

    const result = await runWithCapturedIo(["config", "validate", "--json"], workspaceDirectory);
    const response = JSON.parse(result.stdout);

    expect(result).toMatchObject({ code: 3, stderr: "" });
    expect(response).toMatchObject({
      schemaVersion: "devdeck.response.v1",
      ok: false,
      command: "config.validate",
      error: {
        code: "DD_CONFIG_INVALID_YAML",
        severity: "error",
        retryable: false,
      },
    });
    expect(result.stdout).not.toContain("stack");
  });

  it("returns a structured json error for unknown dependencies", async () => {
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
        "    dependsOn:",
        "      - db",
      ].join("\n"),
    );

    const result = await runWithCapturedIo(["config", "validate", "--json"], workspaceDirectory);
    const response = JSON.parse(result.stdout);

    expect(result).toMatchObject({ code: 3, stderr: "" });
    expect(response).toMatchObject({
      ok: false,
      command: "config.validate",
      error: {
        code: "DD_CONFIG_DEPENDENCY_UNKNOWN",
        retryable: false,
      },
    });
    expect(result.stdout).not.toContain("stack");
  });

  it("reports missing env files as validation findings", async () => {
    const workspaceDirectory = await createWorkspace();
    await writeConfig(
      workspaceDirectory,
      [
        "version: 2",
        "project: sample-app",
        "services:",
        "  api:",
        "    command: npm run api",
        "    cwd: .",
        "    envFiles:",
        "      - .env.missing",
      ].join("\n"),
    );

    const result = await runWithCapturedIo(["config", "validate", "--json"], workspaceDirectory);
    const response = JSON.parse(result.stdout);

    expect(result).toMatchObject({ code: 3, stderr: "" });
    expect(response).toMatchObject({
      ok: false,
      command: "config.validate",
      result: {
        valid: false,
        findings: [
          {
            code: "DD_CONFIG_ENV_FILE_MISSING",
            severity: "error",
            service: "api",
          },
        ],
      },
      error: {
        code: "DD_CONFIG_VALIDATION_FAILED",
      },
    });
  });

  it("reports invalid env files as validation findings", async () => {
    const workspaceDirectory = await createWorkspace();
    await writeFile(path.join(workspaceDirectory, ".env"), "DEVDECK_TEST_API_KEY\n", "utf8");
    await writeConfig(
      workspaceDirectory,
      [
        "version: 2",
        "project: sample-app",
        "services:",
        "  api:",
        "    command: npm run api",
        "    cwd: .",
        "    envFiles:",
        "      - .env",
      ].join("\n"),
    );

    const result = await runWithCapturedIo(["config", "validate", "--json"], workspaceDirectory);
    const response = JSON.parse(result.stdout);

    expect(result.code).toBe(3);
    expect(response.result.findings).toContainEqual(
      expect.objectContaining({
        code: "DD_CONFIG_ENV_FILE_INVALID",
        severity: "error",
        service: "api",
      }),
    );
  });

  it("reports missing required env without printing secret values", async () => {
    const workspaceDirectory = await createWorkspace();
    await writeFile(
      path.join(workspaceDirectory, ".env"),
      "DEVDECK_TEST_API_KEY=postgres://super-secret@localhost/sample\n",
      "utf8",
    );
    await writeConfig(
      workspaceDirectory,
      [
        "version: 2",
        "project: sample-app",
        "services:",
        "  api:",
        "    command: npm run api",
        "    cwd: .",
        "    envFiles:",
        "      - .env",
        "    requiredEnv:",
        "      - DEVDECK_TEST_DATABASE_URL",
      ].join("\n"),
    );

    const result = await runWithCapturedIo(["config", "validate", "--json"], workspaceDirectory);
    const response = JSON.parse(result.stdout);

    expect(result).toMatchObject({ code: 3, stderr: "" });
    expect(response).toMatchObject({
      ok: false,
      result: {
        valid: false,
        findings: [
          {
            code: "DD_CONFIG_ENV_MISSING",
            severity: "error",
            service: "api",
          },
        ],
      },
      error: {
        code: "DD_CONFIG_VALIDATION_FAILED",
      },
    });
    expect(result.stdout).not.toContain("postgres://super-secret");
  });

  it("treats empty required env values as missing", async () => {
    const workspaceDirectory = await createWorkspace();
    process.env.DEVDECK_TEST_API_KEY = "";
    await writeFile(path.join(workspaceDirectory, ".env"), "DEVDECK_TEST_DATABASE_URL=\n", "utf8");
    await writeConfig(
      workspaceDirectory,
      [
        "version: 2",
        "project: sample-app",
        "services:",
        "  api:",
        "    command: npm run api",
        "    cwd: .",
        "    envFiles:",
        "      - .env",
        "    requiredEnv:",
        "      - DEVDECK_TEST_DATABASE_URL",
        "      - DEVDECK_TEST_API_KEY",
      ].join("\n"),
    );

    const result = await runWithCapturedIo(["config", "validate", "--json"], workspaceDirectory);
    const response = JSON.parse(result.stdout);

    expect(result.code).toBe(3);
    expect(response.result.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "DD_CONFIG_ENV_MISSING",
          service: "api",
          message: expect.stringContaining("DEVDECK_TEST_DATABASE_URL"),
        }),
        expect.objectContaining({
          code: "DD_CONFIG_ENV_MISSING",
          service: "api",
          message: expect.stringContaining("DEVDECK_TEST_API_KEY"),
        }),
      ]),
    );
  });

  it("explains normalized config as json without dumping env values", async () => {
    const workspaceDirectory = await createWorkspace(["apps/api", "apps/web"]);
    await writeFile(
      path.join(workspaceDirectory, ".env"),
      "DEVDECK_TEST_DATABASE_URL=postgres://super-secret@localhost/sample\n",
      "utf8",
    );
    await writeConfig(
      workspaceDirectory,
      [
        "version: 2",
        "project: sample-app",
        "services:",
        "  api:",
        "    command: npm run api",
        "    cwd: ./apps/api",
        "    group: backend",
        "    envFiles:",
        "      - .env",
        "    requiredEnv:",
        "      - DEVDECK_TEST_DATABASE_URL",
        "    health:",
        "      type: http",
        "      url: http://127.0.0.1:4000/health",
        "      expectedStatus: 200",
        "    readiness:",
        "      type: log",
        "      pattern: server listening",
        "    links:",
        "      - label: API",
        "        url: http://127.0.0.1:4000",
        "  web:",
        "    exec:",
        "      argv: [npm, run, dev]",
        "    cwd: ./apps/web",
        "    dependsOn:",
        "      api:",
        "        condition: ready",
      ].join("\n"),
    );

    const result = await runWithCapturedIo(["config", "explain", "--json"], workspaceDirectory);
    const response = JSON.parse(result.stdout);

    expect(result).toMatchObject({ code: 0, stderr: "" });
    expect(response).toMatchObject({
      ok: true,
      command: "config.explain",
      project: "sample-app",
      result: {
        project: "sample-app",
        version: 2,
        serviceCount: 2,
        services: [
          {
            name: "api",
            command: "npm run api",
            cwd: "./apps/api",
            resolvedCwd: path.join(workspaceDirectory, "apps/api"),
            group: "backend",
            dependencies: [],
            health: {
              type: "http",
              url: "http://127.0.0.1:4000/health",
              expectedStatus: 200,
            },
            readiness: {
              type: "log",
              pattern: "server listening",
            },
            env: {
              envFiles: [".env"],
              requiredEnv: ["DEVDECK_TEST_DATABASE_URL"],
              satisfied: ["DEVDECK_TEST_DATABASE_URL"],
              missing: [],
            },
            links: [{ label: "API", url: "http://127.0.0.1:4000" }],
          },
          {
            name: "web",
            exec: { argv: ["npm", "run", "dev"] },
            dependencies: [{ service: "api", condition: "ready" }],
          },
        ],
      },
    });
    expect(result.stdout).not.toContain("postgres://super-secret");
  });

  it("explains normalized config in human mode", async () => {
    const workspaceDirectory = await createWorkspace();
    await writeConfig(
      workspaceDirectory,
      [
        "version: 2",
        "project: sample-app",
        "services:",
        "  api:",
        "    command: npm run api",
        "    cwd: .",
        "    requiredEnv:",
        "      - DEVDECK_TEST_DATABASE_URL",
      ].join("\n"),
    );

    const result = await runWithCapturedIo(["config", "explain"], workspaceDirectory);

    expect(result).toMatchObject({ code: 0, stderr: "" });
    expect(result.stdout).toContain("Project: sample-app");
    expect(result.stdout).toContain(`Config: ${path.join(workspaceDirectory, "devdeck.yml")}`);
    expect(result.stdout).toContain("Services: 1");
    expect(result.stdout).toContain("api");
    expect(result.stdout).toContain("required env: DEVDECK_TEST_DATABASE_URL missing");
  });

  it("maps invalid config subcommands to cli usage json errors", async () => {
    const workspaceDirectory = await createWorkspace();

    const result = await runWithCapturedIo(["config", "bogus", "--json"], workspaceDirectory);
    const response = JSON.parse(result.stdout);

    expect(result).toMatchObject({ code: 2, stderr: "" });
    expect(response).toMatchObject({
      ok: false,
      command: "config",
      error: {
        code: "DD_CLI_USAGE_INVALID",
        message: "Usage: devdeck config <validate|explain> [--json]",
      },
    });
  });

  it("recognizes node entrypoint paths", () => {
    const entrypointPath = path.join(process.cwd(), "dist", "index.js");

    expect(
      isCliEntrypoint(
        pathToFileURL(entrypointPath).href,
        entrypointPath,
      ),
    ).toBe(true);
    expect(
      isCliEntrypoint(
        pathToFileURL(entrypointPath).href,
        path.join(process.cwd(), "dist", "other.js"),
      ),
    ).toBe(false);
  });
});

async function createWorkspace(directories: string[] = ["frontend"]): Promise<string> {
  const workspaceDirectory = await mkdtemp(path.join(os.tmpdir(), "devdeck-cli-config-"));
  tempDirectories.push(workspaceDirectory);

  await Promise.all(
    directories.map((directory) =>
      mkdir(path.join(workspaceDirectory, directory), { recursive: true }),
    ),
  );

  return workspaceDirectory;
}

async function writeConfig(workspaceDirectory: string, source: string): Promise<void> {
  await writeFile(path.join(workspaceDirectory, "devdeck.yml"), `${source}\n`, "utf8");
}

async function runWithCapturedIo(argv: string[], cwd: string): Promise<{
  code: number;
  stdout: string;
  stderr: string;
}> {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const code = await runCli(argv, {
    cwd,
    io: {
      stdout: (message) => stdout.push(message),
      stderr: (message) => stderr.push(message),
    },
  });

  return {
    code,
    stdout: stdout.join(""),
    stderr: stderr.join(""),
  };
}
