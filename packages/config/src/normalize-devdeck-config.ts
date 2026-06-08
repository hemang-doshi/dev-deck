import { stat } from "node:fs/promises";
import path from "node:path";

import { ConfigError } from "./errors.js";
import type {
  DevdeckConfigV1,
  DevdeckConfigV2,
  DevdeckDependencyCondition,
  DevdeckHealthConfig,
  DevdeckLinkConfig,
  DevdeckReadinessConfig,
  DevdeckRestartPolicyMode,
  DevdeckStopConfig,
  NormalizedDevdeckConfig,
  NormalizedDevdeckDependency,
  NormalizedRestartPolicy,
  RawDevdeckConfig,
} from "./schema.js";
import {
  assertExpectedStatus,
  assertHttpUrl,
  assertNonEmptyString,
  assertOptionalNonEmptyString,
  assertOptionalNonNegativeInteger,
  assertOptionalPositiveInteger,
  assertOptionalStringArray,
  assertPositiveInteger,
  assertStringArray,
  assertUrl,
  isRecord,
} from "./validators.js";

const VALID_DEPENDENCY_CONDITIONS = new Set<DevdeckDependencyCondition>([
  "started",
  "ready",
  "healthy",
  "completed_successfully",
]);

const VALID_RESTART_MODES = new Set<DevdeckRestartPolicyMode>([
  "never",
  "on-failure",
  "always",
]);

export function validateRawConfig(
  parsed: unknown,
  configPath: string,
): RawDevdeckConfig {
  if (!isRecord(parsed)) {
    throw new ConfigError(
      "DD-ERR-0004",
      `Expected ${configPath} to contain a YAML object.`,
      "Check that devdeck.yml is formatted correctly as a YAML object.",
    );
  }

  if (parsed.version !== undefined && parsed.version !== 2) {
    throw new ConfigError(
      "DD-ERR-0004",
      `Expected "version" to be 2 in ${configPath}.`,
      "Remove the version field for legacy v1 config or set 'version: 2'.",
    );
  }

  return parsed as RawDevdeckConfig;
}

export async function normalizeConfig(
  raw: RawDevdeckConfig,
  directory: string,
  configPath: string,
): Promise<NormalizedDevdeckConfig> {
  const project = assertNonEmptyString(
    raw.project,
    "DD-ERR-0004",
    `Expected "project" to be a non-empty string in ${configPath}.`,
    "Define a non-empty 'project' name string at the top level of devdeck.yml.",
  );

  if (!isRecord(raw.services) || Object.keys(raw.services).length === 0) {
    throw new ConfigError(
      "DD-ERR-0004",
      `Expected "services" to be a non-empty object in ${configPath}.`,
      "Define at least one service under the 'services' object in devdeck.yml.",
    );
  }

  const isV2 = "version" in raw && raw.version === 2;
  const services: NormalizedDevdeckConfig["services"] = {};

  for (const [serviceName, rawService] of Object.entries(raw.services)) {
    services[serviceName] = await normalizeServiceConfig(
      serviceName,
      rawService,
      directory,
      configPath,
      isV2,
    );
  }

  return {
    version: 2,
    project,
    services,
  };
}

async function normalizeServiceConfig(
  serviceName: string,
  rawService: unknown,
  directory: string,
  configPath: string,
  isV2: boolean,
): Promise<NormalizedDevdeckConfig["services"][string]> {
  if (!isRecord(rawService)) {
    throw new ConfigError(
      "DD-ERR-0004",
      `Expected service "${serviceName}" to be an object in ${configPath}.`,
      `Ensure the configuration for service '${serviceName}' is defined as a YAML map/object.`,
    );
  }

  const command = normalizeCommand(serviceName, rawService, configPath, isV2);
  const exec = normalizeExec(serviceName, rawService, configPath, isV2);

  validateCommandExec(serviceName, command, exec, configPath, isV2);

  const cwd = assertNonEmptyString(
    rawService.cwd,
    "DD-ERR-0006",
    `Expected service "${serviceName}" to define a non-empty "cwd" in ${configPath}.`,
    `Define a 'cwd' string specifying the working directory for service '${serviceName}'.`,
  );
  const resolvedCwd = await resolveServiceCwd(serviceName, cwd, directory);
  const group = assertOptionalNonEmptyString(
    rawService.group,
    "DD-ERR-0008",
    `Expected service "${serviceName}" group to be a non-empty string in ${configPath}.`,
    `Remove or correct the 'group' property for service '${serviceName}'. It must be a non-empty string.`,
  );
  const port = normalizePort(serviceName, rawService.port, configPath);
  const health = normalizeHealth(serviceName, rawService.health, configPath);
  const readiness = normalizeReadiness(
    serviceName,
    rawService.readiness,
    configPath,
  );
  const links = normalizeLinks(serviceName, rawService.links, configPath);
  const legacyPortHealth = port
    ? { type: "tcp" as const, host: "127.0.0.1", port }
    : undefined;

  return {
    name: serviceName,
    ...(command === undefined ? {} : { command }),
    ...(exec === undefined ? {} : { exec }),
    cwd,
    resolvedCwd,
    ...(group === undefined ? {} : { group }),
    dependsOn: normalizeDependsOn(serviceName, rawService.dependsOn, configPath),
    envFiles: assertOptionalStringArray(
      rawService.envFiles,
      "DD_CONFIG_ENV_FILES_INVALID",
      `Expected service "${serviceName}" envFiles to be an array of non-empty strings in ${configPath}.`,
      `Correct the 'envFiles' property for service '${serviceName}'.`,
    ),
    requiredEnv: assertOptionalStringArray(
      rawService.requiredEnv,
      "DD_CONFIG_REQUIRED_ENV_INVALID",
      `Expected service "${serviceName}" requiredEnv to be an array of non-empty strings in ${configPath}.`,
      `Correct the 'requiredEnv' property for service '${serviceName}'.`,
    ),
    ...(health ?? legacyPortHealth
      ? { health: health ?? legacyPortHealth }
      : {}),
    ...(readiness === undefined ? {} : { readiness }),
    restartPolicy: normalizeRestartPolicy(
      serviceName,
      rawService.restartPolicy,
      configPath,
    ),
    ...(rawService.stop === undefined
      ? {}
      : { stop: normalizeStop(serviceName, rawService.stop, configPath) }),
    links: [
      ...links,
      ...(port && links.length === 0
        ? [{ label: serviceName, url: `http://127.0.0.1:${port}` }]
        : []),
    ],
    ...(port === undefined ? {} : { port, legacyPort: port }),
  };
}

function normalizeCommand(
  serviceName: string,
  rawService: Record<string, unknown>,
  configPath: string,
  isV2: boolean,
): string | undefined {
  if (rawService.command === undefined) {
    return undefined;
  }

  return assertNonEmptyString(
    rawService.command,
    isV2 ? "DD_CONFIG_COMMAND_INVALID" : "DD-ERR-0005",
    `Expected service "${serviceName}" to define a non-empty "command" in ${configPath}.`,
    `Define a 'command' string (e.g. 'npm run dev') for service '${serviceName}'.`,
  );
}

function normalizeExec(
  serviceName: string,
  rawService: Record<string, unknown>,
  configPath: string,
  isV2: boolean,
): { argv: string[] } | undefined {
  if (rawService.exec === undefined) {
    return undefined;
  }

  if (!isV2 || !isRecord(rawService.exec)) {
    throw new ConfigError(
      "DD_CONFIG_COMMAND_INVALID",
      `Expected service "${serviceName}" exec to define argv in ${configPath}.`,
      `Define 'exec.argv' as a non-empty string array for service '${serviceName}'.`,
    );
  }

  const argv = assertStringArray(
    rawService.exec.argv,
    "DD_CONFIG_COMMAND_INVALID",
    `Expected service "${serviceName}" exec.argv to be a non-empty string array in ${configPath}.`,
    `Define 'exec.argv' with at least one command argument for service '${serviceName}'.`,
  );

  if (argv.length === 0) {
    throw new ConfigError(
      "DD_CONFIG_COMMAND_INVALID",
      `Expected service "${serviceName}" exec.argv to contain at least one item in ${configPath}.`,
      `Define 'exec.argv' with at least one command argument for service '${serviceName}'.`,
    );
  }

  return { argv };
}

function validateCommandExec(
  serviceName: string,
  command: string | undefined,
  exec: { argv: string[] } | undefined,
  configPath: string,
  isV2: boolean,
): void {
  if (command && exec) {
    throw new ConfigError(
      "DD_CONFIG_COMMAND_INVALID",
      `Expected service "${serviceName}" to define either "command" or "exec", not both, in ${configPath}.`,
      `Remove either 'command' or 'exec' from service '${serviceName}'.`,
    );
  }

  if (!command && !exec) {
    throw new ConfigError(
      isV2 ? "DD_CONFIG_COMMAND_INVALID" : "DD-ERR-0005",
      `Expected service "${serviceName}" to define a non-empty "command" in ${configPath}.`,
      `Define a 'command' string (e.g. 'npm run dev') for service '${serviceName}'.`,
    );
  }
}

async function resolveServiceCwd(
  serviceName: string,
  cwd: string,
  directory: string,
): Promise<string> {
  const resolvedCwd = path.resolve(directory, cwd);
  let cwdStats;

  try {
    cwdStats = await stat(resolvedCwd);
  } catch {
    throw new ConfigError(
      "DD-ERR-0007",
      `Expected service "${serviceName}" cwd to exist: ${resolvedCwd}.`,
      `Create the working directory at '${resolvedCwd}' or update the 'cwd' path in devdeck.yml.`,
    );
  }

  if (!cwdStats.isDirectory()) {
    throw new ConfigError(
      "DD-ERR-0007",
      `Expected service "${serviceName}" cwd to be a directory: ${resolvedCwd}.`,
      `Ensure the path '${resolvedCwd}' points to a valid directory, not a file.`,
    );
  }

  return resolvedCwd;
}

function normalizePort(
  serviceName: string,
  port: unknown,
  configPath: string,
): number | undefined {
  return assertOptionalPositiveInteger(
    port,
    "DD-ERR-0009",
    `Expected service "${serviceName}" port to be a positive integer in ${configPath}.`,
    `Correct the 'port' property for service '${serviceName}'. It must be a positive integer (e.g. 3000).`,
  );
}

function normalizeDependsOn(
  serviceName: string,
  dependsOn: unknown,
  configPath: string,
): Record<string, NormalizedDevdeckDependency> {
  if (dependsOn === undefined) {
    return {};
  }

  if (Array.isArray(dependsOn)) {
    return dependsOn.reduce<Record<string, NormalizedDevdeckDependency>>(
      (normalized, dependencyName) => {
        const name = assertNonEmptyString(
          dependencyName,
          "DD_CONFIG_DEPENDENCY_UNKNOWN",
          `Expected service "${serviceName}" dependsOn array to contain service names in ${configPath}.`,
          `Correct the 'dependsOn' entries for service '${serviceName}'.`,
        );
        normalized[name] = { condition: "started" };
        return normalized;
      },
      {},
    );
  }

  if (!isRecord(dependsOn)) {
    throw new ConfigError(
      "DD_CONFIG_DEPENDENCY_UNKNOWN",
      `Expected service "${serviceName}" dependsOn to be an array or object in ${configPath}.`,
      `Correct the 'dependsOn' property for service '${serviceName}'.`,
    );
  }

  const normalized: Record<string, NormalizedDevdeckDependency> = {};

  for (const [dependencyName, dependencyConfig] of Object.entries(dependsOn)) {
    if (dependencyConfig === null || dependencyConfig === undefined) {
      normalized[dependencyName] = { condition: "started" };
      continue;
    }

    if (!isRecord(dependencyConfig)) {
      throw new ConfigError(
        "DD_CONFIG_DEPENDENCY_CONDITION_INVALID",
        `Expected dependency "${dependencyName}" for service "${serviceName}" to be an object in ${configPath}.`,
        `Define a valid dependency condition for '${dependencyName}'.`,
      );
    }

    const condition = dependencyConfig.condition ?? "started";

    if (
      typeof condition !== "string" ||
      !VALID_DEPENDENCY_CONDITIONS.has(condition as DevdeckDependencyCondition)
    ) {
      throw new ConfigError(
        "DD_CONFIG_DEPENDENCY_CONDITION_INVALID",
        `Invalid dependency condition for service "${serviceName}" dependency "${dependencyName}" in ${configPath}.`,
        "Use one of: started, ready, healthy, completed_successfully.",
      );
    }

    normalized[dependencyName] = {
      condition: condition as DevdeckDependencyCondition,
    };
  }

  return normalized;
}

function normalizeHealth(
  serviceName: string,
  health: unknown,
  configPath: string,
): DevdeckHealthConfig | undefined {
  if (health === undefined) {
    return undefined;
  }

  if (!isRecord(health)) {
    throw invalidHealth(serviceName, configPath);
  }

  switch (health.type) {
    case "tcp":
      return {
        type: "tcp",
        ...normalizeHost("health", health.host),
        port: assertPositiveInteger(
          health.port,
          "DD_CONFIG_HEALTH_INVALID",
          `Expected tcp health for service "${serviceName}" to define a valid port in ${configPath}.`,
          `Correct the 'health.port' property for service '${serviceName}'.`,
        ),
        ...normalizeTimeout("health", serviceName, health.timeoutMs, configPath),
      };
    case "http":
      return {
        type: "http",
        url: assertHttpUrl(
          health.url,
          "DD_CONFIG_HEALTH_INVALID",
          `Expected http health for service "${serviceName}" to define an http/https url in ${configPath}.`,
          `Correct the 'health.url' property for service '${serviceName}'.`,
        ),
        ...normalizeExpectedStatus(
          "health",
          serviceName,
          health.expectedStatus,
          configPath,
        ),
        ...normalizeTimeout("health", serviceName, health.timeoutMs, configPath),
      };
    case "command":
      return {
        type: "command",
        command: assertNonEmptyString(
          health.command,
          "DD_CONFIG_HEALTH_INVALID",
          `Expected command health for service "${serviceName}" to define a non-empty command in ${configPath}.`,
          `Correct the 'health.command' property for service '${serviceName}'.`,
        ),
        ...normalizeTimeout("health", serviceName, health.timeoutMs, configPath),
      };
    default:
      throw invalidHealth(serviceName, configPath);
  }
}

function normalizeReadiness(
  serviceName: string,
  readiness: unknown,
  configPath: string,
): DevdeckReadinessConfig | undefined {
  if (readiness === undefined) {
    return undefined;
  }

  if (!isRecord(readiness)) {
    throw invalidReadiness(serviceName, configPath);
  }

  switch (readiness.type) {
    case "log":
      return {
        type: "log",
        pattern: assertNonEmptyString(
          readiness.pattern,
          "DD_CONFIG_READINESS_INVALID",
          `Expected log readiness for service "${serviceName}" to define a non-empty pattern in ${configPath}.`,
          `Correct the 'readiness.pattern' property for service '${serviceName}'.`,
        ),
      };
    case "tcp":
      return {
        type: "tcp",
        ...normalizeHost("readiness", readiness.host),
        port: assertPositiveInteger(
          readiness.port,
          "DD_CONFIG_READINESS_INVALID",
          `Expected tcp readiness for service "${serviceName}" to define a valid port in ${configPath}.`,
          `Correct the 'readiness.port' property for service '${serviceName}'.`,
        ),
        ...normalizeTimeout(
          "readiness",
          serviceName,
          readiness.timeoutMs,
          configPath,
        ),
      };
    case "http":
      return {
        type: "http",
        url: assertHttpUrl(
          readiness.url,
          "DD_CONFIG_READINESS_INVALID",
          `Expected http readiness for service "${serviceName}" to define an http/https url in ${configPath}.`,
          `Correct the 'readiness.url' property for service '${serviceName}'.`,
        ),
        ...normalizeExpectedStatus(
          "readiness",
          serviceName,
          readiness.expectedStatus,
          configPath,
        ),
        ...normalizeTimeout(
          "readiness",
          serviceName,
          readiness.timeoutMs,
          configPath,
        ),
      };
    default:
      throw invalidReadiness(serviceName, configPath);
  }
}

function normalizeRestartPolicy(
  serviceName: string,
  restartPolicy: unknown,
  configPath: string,
): NormalizedRestartPolicy {
  if (restartPolicy === undefined) {
    return { mode: "never" };
  }

  if (!isRecord(restartPolicy) || typeof restartPolicy.mode !== "string") {
    throw new ConfigError(
      "DD_CONFIG_RESTART_POLICY_INVALID",
      `Expected service "${serviceName}" restartPolicy to define a valid mode in ${configPath}.`,
      "Use one of: never, on-failure, always.",
    );
  }

  if (!VALID_RESTART_MODES.has(restartPolicy.mode as DevdeckRestartPolicyMode)) {
    throw new ConfigError(
      "DD_CONFIG_RESTART_POLICY_INVALID",
      `Invalid restartPolicy mode for service "${serviceName}" in ${configPath}.`,
      "Use one of: never, on-failure, always.",
    );
  }

  const maxRestarts = assertOptionalPositiveInteger(
    restartPolicy.maxRestarts,
    "DD_CONFIG_RESTART_POLICY_INVALID",
    `Expected service "${serviceName}" restartPolicy.maxRestarts to be a positive integer in ${configPath}.`,
    `Correct the 'restartPolicy.maxRestarts' property for service '${serviceName}'.`,
  );
  const delayMs = assertOptionalNonNegativeInteger(
    restartPolicy.delayMs,
    "DD_CONFIG_RESTART_POLICY_INVALID",
    `Expected service "${serviceName}" restartPolicy.delayMs to be a non-negative integer in ${configPath}.`,
    `Correct the 'restartPolicy.delayMs' property for service '${serviceName}'.`,
  );

  return {
    mode: restartPolicy.mode as DevdeckRestartPolicyMode,
    ...(maxRestarts === undefined ? {} : { maxRestarts }),
    ...(delayMs === undefined ? {} : { delayMs }),
  };
}

function normalizeStop(
  serviceName: string,
  stop: unknown,
  configPath: string,
): DevdeckStopConfig {
  if (!isRecord(stop)) {
    throw new ConfigError(
      "DD_CONFIG_STOP_INVALID",
      `Expected service "${serviceName}" stop to be an object in ${configPath}.`,
      `Correct the 'stop' property for service '${serviceName}'.`,
    );
  }

  const command = assertOptionalNonEmptyString(
    stop.command,
    "DD_CONFIG_STOP_INVALID",
    `Expected service "${serviceName}" stop.command to be non-empty when present in ${configPath}.`,
    `Correct the 'stop.command' property for service '${serviceName}'.`,
  );
  const timeoutMs = assertOptionalPositiveInteger(
    stop.timeoutMs,
    "DD_CONFIG_STOP_INVALID",
    `Expected service "${serviceName}" stop.timeoutMs to be a positive integer in ${configPath}.`,
    `Correct the 'stop.timeoutMs' property for service '${serviceName}'.`,
  );

  return {
    ...(command === undefined ? {} : { command }),
    ...(timeoutMs === undefined ? {} : { timeoutMs }),
  };
}

function normalizeLinks(
  serviceName: string,
  links: unknown,
  configPath: string,
): DevdeckLinkConfig[] {
  if (links === undefined) {
    return [];
  }

  if (!Array.isArray(links)) {
    throw new ConfigError(
      "DD_CONFIG_LINKS_INVALID",
      `Expected service "${serviceName}" links to be an array in ${configPath}.`,
      `Correct the 'links' property for service '${serviceName}'.`,
    );
  }

  return links.map((link, index) => {
    if (!isRecord(link)) {
      throw new ConfigError(
        "DD_CONFIG_LINKS_INVALID",
        `Expected service "${serviceName}" link at index ${index} to be an object in ${configPath}.`,
        `Correct the 'links' property for service '${serviceName}'.`,
      );
    }

    return {
      label: assertNonEmptyString(
        link.label,
        "DD_CONFIG_LINKS_INVALID",
        `Expected service "${serviceName}" link at index ${index} to define a non-empty label in ${configPath}.`,
        `Correct the 'links.label' property for service '${serviceName}'.`,
      ),
      url: assertUrl(
        link.url,
        "DD_CONFIG_LINKS_INVALID",
        `Expected service "${serviceName}" link at index ${index} to define a valid url in ${configPath}.`,
        `Correct the 'links.url' property for service '${serviceName}'.`,
      ),
    };
  });
}

function normalizeHost(
  key: "health" | "readiness",
  host: unknown,
): { host?: string } {
  if (host === undefined) {
    return {};
  }

  if (typeof host !== "string" || host.trim() === "") {
    throw new ConfigError(
      key === "health" ? "DD_CONFIG_HEALTH_INVALID" : "DD_CONFIG_READINESS_INVALID",
      "Expected host to be a non-empty string when present.",
      "Correct the host property in devdeck.yml.",
    );
  }

  return { host: host.trim() };
}

function normalizeTimeout(
  key: "health" | "readiness",
  serviceName: string,
  timeoutMs: unknown,
  configPath: string,
): { timeoutMs?: number } {
  const timeout = assertOptionalPositiveInteger(
    timeoutMs,
    key === "health" ? "DD_CONFIG_HEALTH_INVALID" : "DD_CONFIG_READINESS_INVALID",
    `Expected service "${serviceName}" ${key}.timeoutMs to be a positive integer in ${configPath}.`,
    `Correct the '${key}.timeoutMs' property for service '${serviceName}'.`,
  );

  return timeout === undefined ? {} : { timeoutMs: timeout };
}

function normalizeExpectedStatus(
  key: "health" | "readiness",
  serviceName: string,
  expectedStatus: unknown,
  configPath: string,
): { expectedStatus?: number } {
  const status = assertExpectedStatus(
    expectedStatus,
    key === "health" ? "DD_CONFIG_HEALTH_INVALID" : "DD_CONFIG_READINESS_INVALID",
    `Expected service "${serviceName}" ${key}.expectedStatus to be an integer from 100 to 599 in ${configPath}.`,
    `Correct the '${key}.expectedStatus' property for service '${serviceName}'.`,
  );

  return status === undefined ? {} : { expectedStatus: status };
}

function invalidHealth(serviceName: string, configPath: string): ConfigError {
  return new ConfigError(
    "DD_CONFIG_HEALTH_INVALID",
    `Expected service "${serviceName}" health to use type tcp, http, or command in ${configPath}.`,
    `Correct the 'health.type' property for service '${serviceName}'.`,
  );
}

function invalidReadiness(serviceName: string, configPath: string): ConfigError {
  return new ConfigError(
    "DD_CONFIG_READINESS_INVALID",
    `Expected service "${serviceName}" readiness to use type log, http, or tcp in ${configPath}.`,
    `Correct the 'readiness.type' property for service '${serviceName}'.`,
  );
}

export type { DevdeckConfigV1, DevdeckConfigV2 };
