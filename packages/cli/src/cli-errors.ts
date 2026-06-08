export class CliUsageError extends Error {
  constructor(
    message: string,
    public readonly hint?: string,
  ) {
    super(message);
    this.name = "CliUsageError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
