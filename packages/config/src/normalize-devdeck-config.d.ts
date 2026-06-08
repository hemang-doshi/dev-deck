import type { DevdeckConfigV1, DevdeckConfigV2, NormalizedDevdeckConfig, RawDevdeckConfig } from "./schema.js";
export declare function validateRawConfig(parsed: unknown, configPath: string): RawDevdeckConfig;
export declare function normalizeConfig(raw: RawDevdeckConfig, directory: string, configPath: string): Promise<NormalizedDevdeckConfig>;
export type { DevdeckConfigV1, DevdeckConfigV2 };
