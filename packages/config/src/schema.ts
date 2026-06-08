export type DevdeckConfigVersion = 1 | 2;

export type DevdeckConfigV1 = {
  project: string;
  services: Record<string, DevdeckServiceConfigV1>;
};

export type DevdeckServiceConfigV1 = {
  command: string;
  cwd: string;
  group?: string;
  port?: number;
};

export type DevdeckConfigV2 = {
  version: 2;
  project: string;
  defaults?: DevdeckDefaultsConfig;
  services: Record<string, DevdeckServiceConfigV2>;
};

export type DevdeckDefaultsConfig = {
  shell?: boolean;
  startupTimeoutMs?: number;
  shutdownTimeoutMs?: number;
  restartPolicy?: DevdeckRestartPolicyConfig;
  log?: {
    maxLines?: number;
    persist?: boolean;
    redact?: string[];
  };
};

export type DevdeckServiceConfigV2 = {
  command?: string;
  exec?: DevdeckExecConfig;
  cwd: string;
  group?: string;
  dependsOn?: string[] | Record<string, DevdeckDependencyConfig>;
  envFiles?: string[];
  requiredEnv?: string[];
  health?: DevdeckHealthConfig;
  readiness?: DevdeckReadinessConfig;
  restartPolicy?: DevdeckRestartPolicyConfig;
  stop?: DevdeckStopConfig;
  links?: DevdeckLinkConfig[];
  port?: number;
};

export type DevdeckExecConfig = {
  argv: string[];
};

export type DevdeckDependencyCondition =
  | "started"
  | "ready"
  | "healthy"
  | "completed_successfully";

export type DevdeckDependencyConfig = {
  condition?: DevdeckDependencyCondition;
};

export type DevdeckHealthConfig =
  | DevdeckTcpHealthConfig
  | DevdeckHttpHealthConfig
  | DevdeckCommandHealthConfig;

export type DevdeckTcpHealthConfig = {
  type: "tcp";
  host?: string;
  port: number;
  timeoutMs?: number;
};

export type DevdeckHttpHealthConfig = {
  type: "http";
  url: string;
  expectedStatus?: number;
  timeoutMs?: number;
};

export type DevdeckCommandHealthConfig = {
  type: "command";
  command: string;
  timeoutMs?: number;
};

export type DevdeckReadinessConfig =
  | DevdeckLogReadinessConfig
  | DevdeckTcpReadinessConfig
  | DevdeckHttpReadinessConfig;

export type DevdeckLogReadinessConfig = {
  type: "log";
  pattern: string;
};

export type DevdeckTcpReadinessConfig = {
  type: "tcp";
  host?: string;
  port: number;
  timeoutMs?: number;
};

export type DevdeckHttpReadinessConfig = {
  type: "http";
  url: string;
  expectedStatus?: number;
  timeoutMs?: number;
};

export type DevdeckRestartPolicyMode = "never" | "on-failure" | "always";

export type DevdeckRestartPolicyConfig = {
  mode: DevdeckRestartPolicyMode;
  maxRestarts?: number;
  delayMs?: number;
};

export type DevdeckStopConfig = {
  command?: string;
  timeoutMs?: number;
};

export type DevdeckLinkConfig = {
  label: string;
  url: string;
};

export type NormalizedDevdeckConfig = {
  version: 2;
  project: string;
  services: Record<string, NormalizedDevdeckServiceConfig>;
};

export type NormalizedDevdeckServiceConfig = {
  name: string;
  command?: string;
  exec?: DevdeckExecConfig;
  cwd: string;
  resolvedCwd: string;
  group?: string;
  dependsOn: Record<string, NormalizedDevdeckDependency>;
  envFiles: string[];
  requiredEnv: string[];
  health?: DevdeckHealthConfig;
  readiness?: DevdeckReadinessConfig;
  restartPolicy: NormalizedRestartPolicy;
  stop?: DevdeckStopConfig;
  links: DevdeckLinkConfig[];
  port?: number;
  legacyPort?: number;
};

export type NormalizedDevdeckDependency = {
  condition: DevdeckDependencyCondition;
};

export type NormalizedRestartPolicy = {
  mode: DevdeckRestartPolicyMode;
  maxRestarts?: number;
  delayMs?: number;
};

export type RawDevdeckConfig = DevdeckConfigV1 | DevdeckConfigV2;

export type DevdeckConfig = NormalizedDevdeckConfig;
export type DevdeckServiceConfig = NormalizedDevdeckServiceConfig;

export type LoadedDevdeckConfig = {
  path: string;
  directory: string;
  config: DevdeckConfig;
};
