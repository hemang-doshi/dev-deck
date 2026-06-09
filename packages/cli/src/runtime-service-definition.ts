import path from "node:path";

import { DevdeckError, type LoadedDevdeckConfig } from "@devdeck/config";
import type { ServiceDefinition } from "@devdeck/core";

import { readEnvFile } from "./env-file-inspector.js";

export async function createRuntimeServiceDefinitions(
  loaded: LoadedDevdeckConfig,
): Promise<ServiceDefinition[]> {
  return Promise.all(
    Object.values(loaded.config.services).map(async (service) => {
      const env = await loadServiceEnv(loaded.directory, service.envFiles);
      const missingEnv = service.requiredEnv.filter(
        (key) => env[key] === undefined && process.env[key] === undefined,
      );

      if (missingEnv.length > 0) {
        throw new DevdeckError(
          "DD_CONFIG_REQUIRED_ENV_MISSING",
          `Service '${service.name}' is missing required environment variable${missingEnv.length === 1 ? "" : "s"}: ${missingEnv.join(", ")}.`,
          `Set the missing variable${missingEnv.length === 1 ? "" : "s"} in the shell or a configured envFiles entry.`,
        );
      }

      return {
        name: service.name,
        command: service.command,
        exec: service.exec,
        cwd: service.resolvedCwd,
        group: service.group,
        port: service.port,
        env,
        envFiles: service.envFiles,
        requiredEnv: service.requiredEnv,
        dependsOn: service.dependsOn,
        healthProbe: service.health,
        readinessProbe: service.readiness,
        restartPolicy: service.restartPolicy,
        stop: service.stop,
        links: service.links,
      };
    }),
  );
}

async function loadServiceEnv(
  configDirectory: string,
  envFiles: string[],
): Promise<Record<string, string>> {
  const values: Record<string, string> = {};

  for (const envFile of envFiles) {
    Object.assign(values, await readEnvFile(path.resolve(configDirectory, envFile)));
  }

  return values;
}
