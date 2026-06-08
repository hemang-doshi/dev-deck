import { ConfigError } from "./errors.js";

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function assertNonEmptyString(
  value: unknown,
  code: string,
  message: string,
  hint: string,
): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new ConfigError(code, message, hint);
  }

  return value.trim();
}

export function assertOptionalNonEmptyString(
  value: unknown,
  code: string,
  message: string,
  hint: string,
): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  return assertNonEmptyString(value, code, message, hint);
}

export function assertPositiveInteger(
  value: unknown,
  code: string,
  message: string,
  hint: string,
): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    throw new ConfigError(code, message, hint);
  }

  return value;
}

export function assertOptionalPositiveInteger(
  value: unknown,
  code: string,
  message: string,
  hint: string,
): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  return assertPositiveInteger(value, code, message, hint);
}

export function assertOptionalNonNegativeInteger(
  value: unknown,
  code: string,
  message: string,
  hint: string,
): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new ConfigError(code, message, hint);
  }

  return value;
}

export function assertStringArray(
  value: unknown,
  code: string,
  message: string,
  hint: string,
): string[] {
  if (
    !Array.isArray(value) ||
    value.some((item) => typeof item !== "string" || item.trim() === "")
  ) {
    throw new ConfigError(code, message, hint);
  }

  return value.map((item) => item.trim());
}

export function assertOptionalStringArray(
  value: unknown,
  code: string,
  message: string,
  hint: string,
): string[] {
  if (value === undefined) {
    return [];
  }

  return assertStringArray(value, code, message, hint);
}

export function assertHttpUrl(
  value: unknown,
  code: string,
  message: string,
  hint: string,
): string {
  const url = assertNonEmptyString(value, code, message, hint);

  try {
    const parsed = new URL(url);

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error("unsupported protocol");
    }
  } catch {
    throw new ConfigError(code, message, hint);
  }

  return url;
}

export function assertUrl(
  value: unknown,
  code: string,
  message: string,
  hint: string,
): string {
  const url = assertNonEmptyString(value, code, message, hint);

  try {
    new URL(url);
  } catch {
    throw new ConfigError(code, message, hint);
  }

  return url;
}

export function assertExpectedStatus(
  value: unknown,
  code: string,
  message: string,
  hint: string,
): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < 100 ||
    value > 599
  ) {
    throw new ConfigError(code, message, hint);
  }

  return value;
}
