export type DevdeckServiceConfig = {
  command: string;
  cwd: string;
  group?: string;
  port?: number;
};

export type DevdeckConfig = {
  project: string;
  services: Record<string, DevdeckServiceConfig>;
};

export type LoadedDevdeckConfig = {
  path: string;
  directory: string;
  config: DevdeckConfig;
};
