import { access, readFile, stat } from "node:fs/promises";
import path from "node:path";

import { isMap, parseDocument } from "yaml";

import { ConfigError } from "./errors.js";
import type {
  DevdeckConfig,
  DevdeckServiceConfig,
  LoadedDevdeckConfig,
} from "./schema.js";

const CONFIG_FILE_NAME = "devdeck.yml";

export async function findDevdeckConfigPath(
  startDirectory: string = process.cwd(),
): Promise<string | null> {
  let currentDirectory = path.resolve(startDirectory);

  while (true) {
    const candidatePath = path.join(currentDirectory, CONFIG_FILE_NAME);

    try {
      await access(candidatePath);
      return candidatePath;
    } catch {
      const parentDirectory = path.dirname(currentDirectory);

      if (parentDirectory === currentDirectory) {
        return null;
      }

      currentDirectory = parentDirectory;
    }
  }
}

export async function loadDevdeckConfig(
  startDirectory: string = process.cwd(),
): Promise<LoadedDevdeckConfig> {
  const configPath = await findDevdeckConfigPath(startDirectory);

  if (!configPath) {
    throw new ConfigError(
      "DD-ERR-0001",
      `Could not find ${CONFIG_FILE_NAME} starting from ${path.resolve(startDirectory)}.`,
      "Run 'devdeck init' to create a starter devdeck.yml file in the current directory."
    );
  }

  const source = await readFile(configPath, "utf8");
  const document = parseDocument(source, { uniqueKeys: false });
  const duplicateServiceName = getDuplicateServiceName(document);

  if (duplicateServiceName) {
    throw new ConfigError(
      "DD-ERR-0003",
      `Duplicate service name "${duplicateServiceName}" found in ${configPath}.`,
      "Ensure all service names under the 'services' key in devdeck.yml are unique."
    );
  }

  if (document.errors.length > 0) {
    throw new ConfigError(
      "DD-ERR-0002",
      `Invalid YAML in ${configPath}: ${document.errors[0]?.message ?? "parse failed"}`,
      "Fix the YAML syntax errors in devdeck.yml."
    );
  }

  const parsed = document.toJS();
  const directory = path.dirname(configPath);
  const config = await validateConfig(parsed, directory, configPath);

  return {
    path: configPath,
    directory,
    config,
  };
}

async function validateConfig(
  parsed: unknown,
  directory: string,
  configPath: string,
): Promise<DevdeckConfig> {
  if (!isRecord(parsed)) {
    throw new ConfigError(
      "DD-ERR-0004",
      `Expected ${configPath} to contain a YAML object.`,
      "Check that devdeck.yml is formatted correctly as a YAML object."
    );
  }

  const project = parsed.project;
  const services = parsed.services;

  if (typeof project !== "string" || project.trim() === "") {
    throw new ConfigError(
      "DD-ERR-0004",
      `Expected "project" to be a non-empty string in ${configPath}.`,
      "Define a non-empty 'project' name string at the top level of devdeck.yml."
    );
  }

  if (!isRecord(services) || Object.keys(services).length === 0) {
    throw new ConfigError(
      "DD-ERR-0004",
      `Expected "services" to be a non-empty object in ${configPath}.`,
      "Define at least one service under the 'services' object in devdeck.yml."
    );
  }

  const validatedServices: Record<string, DevdeckServiceConfig> = {};

  for (const [serviceName, rawService] of Object.entries(services)) {
    validatedServices[serviceName] = await validateServiceConfig(
      serviceName,
      rawService,
      directory,
      configPath,
    );
  }

  return {
    project: project.trim(),
    services: validatedServices,
  };
}

async function validateServiceConfig(
  serviceName: string,
  rawService: unknown,
  directory: string,
  configPath: string,
): Promise<DevdeckServiceConfig> {
  if (!isRecord(rawService)) {
    throw new ConfigError(
      "DD-ERR-0004",
      `Expected service "${serviceName}" to be an object in ${configPath}.`,
      `Ensure the configuration for service '${serviceName}' is defined as a YAML map/object.`
    );
  }

  const command = rawService.command;
  const cwd = rawService.cwd;
  const group = rawService.group;
  const port = rawService.port;

  if (typeof command !== "string" || command.trim() === "") {
    throw new ConfigError(
      "DD-ERR-0005",
      `Expected service "${serviceName}" to define a non-empty "command" in ${configPath}.`,
      `Define a 'command' string (e.g. 'npm run dev') for service '${serviceName}'.`
    );
  }

  if (typeof cwd !== "string" || cwd.trim() === "") {
    throw new ConfigError(
      "DD-ERR-0006",
      `Expected service "${serviceName}" to define a non-empty "cwd" in ${configPath}.`,
      `Define a 'cwd' string specifying the working directory for service '${serviceName}'.`
    );
  }

  const resolvedCwd = path.resolve(directory, cwd);
  let cwdStats;

  try {
    cwdStats = await stat(resolvedCwd);
  } catch {
    throw new ConfigError(
      "DD-ERR-0007",
      `Expected service "${serviceName}" cwd to exist: ${resolvedCwd}.`,
      `Create the working directory at '${resolvedCwd}' or update the 'cwd' path in devdeck.yml.`
    );
  }

  if (!cwdStats.isDirectory()) {
    throw new ConfigError(
      "DD-ERR-0007",
      `Expected service "${serviceName}" cwd to be a directory: ${resolvedCwd}.`,
      `Ensure the path '${resolvedCwd}' points to a valid directory, not a file.`
    );
  }

  if (
    group !== undefined &&
    (typeof group !== "string" || group.trim() === "")
  ) {
    throw new ConfigError(
      "DD-ERR-0008",
      `Expected service "${serviceName}" group to be a non-empty string in ${configPath}.`,
      `Remove or correct the 'group' property for service '${serviceName}'. It must be a non-empty string.`
    );
  }

  if (
    port !== undefined &&
    (typeof port !== "number" || !Number.isInteger(port) || port <= 0)
  ) {
    throw new ConfigError(
      "DD-ERR-0009",
      `Expected service "${serviceName}" port to be a positive integer in ${configPath}.`,
      `Correct the 'port' property for service '${serviceName}'. It must be a positive integer (e.g. 3000).`
    );
  }

  return {
    command: command.trim(),
    cwd,
    ...(group === undefined ? {} : { group: group.trim() }),
    ...(port === undefined ? {} : { port: port as number }),
  };
}

function getDuplicateServiceName(document: ReturnType<typeof parseDocument>): string | null {
  const servicesNode = document.get("services", true);

  if (!isMap(servicesNode)) {
    return null;
  }

  const seenServiceNames = new Set<string>();

  for (const item of servicesNode.items) {
    const serviceName = String(item.key);

    if (seenServiceNames.has(serviceName)) {
      return serviceName;
    }

    seenServiceNames.add(serviceName);
  }

  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
