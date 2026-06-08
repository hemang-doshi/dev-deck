import { ConfigError } from "./errors.js";
import type { NormalizedDevdeckConfig } from "./schema.js";

export function validateDependencyGraph(
  config: NormalizedDevdeckConfig,
  configPath: string,
): void {
  const serviceNames = new Set(Object.keys(config.services));

  for (const [serviceName, service] of Object.entries(config.services)) {
    for (const dependencyName of Object.keys(service.dependsOn)) {
      if (dependencyName === serviceName) {
        throw new ConfigError(
          "DD_CONFIG_DEPENDENCY_SELF",
          `Service "${serviceName}" cannot depend on itself in ${configPath}.`,
          `Remove '${serviceName}' from its own dependsOn list.`,
        );
      }

      if (!serviceNames.has(dependencyName)) {
        throw new ConfigError(
          "DD_CONFIG_DEPENDENCY_UNKNOWN",
          `Service "${serviceName}" depends on unknown service "${dependencyName}" in ${configPath}.`,
          `Define service '${dependencyName}' or remove it from '${serviceName}.dependsOn'.`,
        );
      }
    }
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();

  for (const serviceName of serviceNames) {
    visitService(serviceName, config, visiting, visited, [], configPath);
  }
}

function visitService(
  serviceName: string,
  config: NormalizedDevdeckConfig,
  visiting: Set<string>,
  visited: Set<string>,
  path: string[],
  configPath: string,
): void {
  if (visited.has(serviceName)) {
    return;
  }

  if (visiting.has(serviceName)) {
    const cycleStart = path.indexOf(serviceName);
    const cycle = [...path.slice(cycleStart), serviceName].join(" -> ");

    throw new ConfigError(
      "DD_CONFIG_DEPENDENCY_CYCLE",
      `Dependency cycle detected in ${configPath}: ${cycle}.`,
      "Remove one of the dependency edges in the cycle.",
    );
  }

  visiting.add(serviceName);

  for (const dependencyName of Object.keys(
    config.services[serviceName]?.dependsOn ?? {},
  )) {
    visitService(
      dependencyName,
      config,
      visiting,
      visited,
      [...path, serviceName],
      configPath,
    );
  }

  visiting.delete(serviceName);
  visited.add(serviceName);
}
