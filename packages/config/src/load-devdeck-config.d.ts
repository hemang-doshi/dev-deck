import type { LoadedDevdeckConfig } from "./schema.js";
export declare function findDevdeckConfigPath(startDirectory?: string): Promise<string | null>;
export declare function loadDevdeckConfig(startDirectory?: string): Promise<LoadedDevdeckConfig>;
