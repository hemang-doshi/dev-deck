export declare class DevdeckError extends Error {
    readonly code: string;
    readonly hint?: string | undefined;
    constructor(code: string, message: string, hint?: string | undefined);
}
export declare class ConfigError extends DevdeckError {
    constructor(code: string, message: string, hint?: string);
}
