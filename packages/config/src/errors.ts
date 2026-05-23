export class DevdeckError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly hint?: string,
  ) {
    super(message);
    this.name = "DevdeckError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ConfigError extends DevdeckError {
  constructor(code: string, message: string, hint?: string) {
    super(code, message, hint);
    this.name = "ConfigError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
