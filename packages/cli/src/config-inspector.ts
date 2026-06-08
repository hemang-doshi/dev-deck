import path from "node:path";

import { loadDevdeckConfig, type LoadedDevdeckConfig } from "@devdeck/config";

import type { Evidence, NextAction } from "./agent-errors.js";
import { EnvFileParseError, readEnvFile } from "./env-file-inspector.js";

export type ConfigFindingSeverity = "info" | "warning" | "error";

export type ConfigFinding = {
  code: string;
  severity: ConfigFindingSeverity;
  service?: string;
  message: string;
  evidence: Evidence[];
  nextActions: NextAction[];
};

export type ConfigDependencySummary = {
  service: string;
  condition: string;
};

export type ConfigEnvSummary = {
  envFiles: string[];
  requiredEnv: string[];
  satisfied: string[];
  missing: string[];
};

export type ConfigServiceSummary = {
  name: string;
  command?: string;
  exec?: { argv: string[] };
  cwd: string;
  resolvedCwd: string;
  group?: string;
  dependencies: ConfigDependencySummary[];
  health?: unknown;
  readiness?: unknown;
  env: ConfigEnvSummary;
  links: Array<{ label: string; url: string }>;
};

export type ConfigInspectionResult = {
  configPath: string;
  project: string;
  version: 2;
  valid: boolean;
  serviceCount: number;
  services: ConfigServiceSummary[];
  findings: ConfigFinding[];
};

export type ConfigInspectorOptions = {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
};

export async function inspectDevdeckConfig(
  options: ConfigInspectorOptions = {},
): Promise<ConfigInspectionResult> {
  const loaded = await loadDevdeckConfig(options.cwd);
  const processEnv = options.env ?? process.env;
  const findings: ConfigFinding[] = [];
  const services: ConfigServiceSummary[] = [];

  for (const service of Object.values(loaded.config.services)) {
    const envFileValues: Record<string, string> = {};

    for (const envFile of service.envFiles) {
      const envFilePath = path.resolve(loaded.directory, envFile);

      try {
        Object.assign(envFileValues, await readEnvFile(envFilePath));
      } catch (error) {
        findings.push(envFileFinding(error, loaded, service.name, envFile, envFilePath));
      }
    }

    const env = summarizeEnv(service.requiredEnv, service.envFiles, envFileValues, processEnv);

    for (const missing of env.missing) {
      findings.push(missingEnvFinding(loaded, service.name, service.envFiles, missing));
    }

    services.push({
      name: service.name,
      ...(service.command === undefined ? {} : { command: service.command }),
      ...(service.exec === undefined ? {} : { exec: { argv: [...service.exec.argv] } }),
      cwd: service.cwd,
      resolvedCwd: service.resolvedCwd,
      ...(service.group === undefined ? {} : { group: service.group }),
      dependencies: Object.entries(service.dependsOn).map(([dependencyName, dependency]) => ({
        service: dependencyName,
        condition: dependency.condition,
      })),
      ...(service.health === undefined ? {} : { health: service.health }),
      ...(service.readiness === undefined ? {} : { readiness: service.readiness }),
      env,
      links: service.links.map((link) => ({ ...link })),
    });
  }

  return {
    configPath: loaded.path,
    project: loaded.config.project,
    version: 2,
    valid: !findings.some((finding) => finding.severity === "error"),
    serviceCount: services.length,
    services,
    findings,
  };
}

function summarizeEnv(
  requiredEnv: string[],
  envFiles: string[],
  envFileValues: Record<string, string>,
  processEnv: NodeJS.ProcessEnv,
): ConfigEnvSummary {
  const satisfied: string[] = [];
  const missing: string[] = [];

  for (const key of requiredEnv) {
    if (hasNonEmptyProcessEnvValue(processEnv, key) || hasNonEmptyEnvFileValue(envFileValues, key)) {
      satisfied.push(key);
    } else {
      missing.push(key);
    }
  }

  return {
    envFiles: [...envFiles],
    requiredEnv: [...requiredEnv],
    satisfied,
    missing,
  };
}

function hasNonEmptyProcessEnvValue(env: NodeJS.ProcessEnv, key: string): boolean {
  return (
    Object.prototype.hasOwnProperty.call(env, key) &&
    typeof env[key] === "string" &&
    env[key].trim() !== ""
  );
}

function hasNonEmptyEnvFileValue(env: Record<string, string>, key: string): boolean {
  return Object.hasOwn(env, key) && env[key]?.trim() !== "";
}

function envFileFinding(
  error: unknown,
  loaded: LoadedDevdeckConfig,
  serviceName: string,
  envFile: string,
  envFilePath: string,
): ConfigFinding {
  const evidence: Evidence[] = [
    {
      type: "config",
      path: loaded.path,
      field: `services.${serviceName}.envFiles`,
      value: envFile,
    },
  ];
  const nextActions: NextAction[] = [
    {
      type: "edit_file",
      path: envFile,
      reason: `Create or correct ${envFile} for service ${serviceName}.`,
    },
  ];

  if (isFileNotFoundError(error)) {
    return {
      code: "DD_CONFIG_ENV_FILE_MISSING",
      severity: "error",
      service: serviceName,
      message: `Service ${serviceName} declares env file ${envFile}, but it was not found.`,
      evidence,
      nextActions,
    };
  }

  if (error instanceof EnvFileParseError) {
    return {
      code: "DD_CONFIG_ENV_FILE_INVALID",
      severity: "error",
      service: serviceName,
      message: `Service ${serviceName} declares env file ${envFile}, but it could not be parsed at line ${error.lineNumber}.`,
      evidence: [
        ...evidence,
        {
          type: "config",
          path: envFilePath,
          field: `line ${error.lineNumber}`,
        },
      ],
      nextActions,
    };
  }

  return {
    code: "DD_CONFIG_ENV_FILE_INVALID",
    severity: "error",
    service: serviceName,
    message: `Service ${serviceName} declares env file ${envFile}, but DevDeck could not read it.`,
    evidence,
    nextActions,
  };
}

function missingEnvFinding(
  loaded: LoadedDevdeckConfig,
  serviceName: string,
  envFiles: string[],
  key: string,
): ConfigFinding {
  const nextActions: NextAction[] =
    envFiles.length > 0
      ? [
          {
            type: "edit_file",
            path: envFiles[0] ?? ".env",
            reason: `Add ${key} or remove it from requiredEnv for service ${serviceName}.`,
          },
        ]
      : [
          {
            type: "manual",
            description: `Export ${key} or add an envFiles entry that defines it.`,
            reason: `Service ${serviceName} requires ${key}.`,
          },
        ];

  return {
    code: "DD_CONFIG_ENV_MISSING",
    severity: "error",
    service: serviceName,
    message: `Service ${serviceName} requires ${key}, but it was not found in process.env or configured envFiles.`,
    evidence: [
      {
        type: "config",
        path: loaded.path,
        field: `services.${serviceName}.requiredEnv`,
        value: key,
      },
    ],
    nextActions,
  };
}

function isFileNotFoundError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "ENOENT"
  );
}
