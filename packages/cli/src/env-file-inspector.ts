import { readFile } from "node:fs/promises";

const ENV_KEY_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

export class EnvFileParseError extends Error {
  constructor(
    public readonly filePath: string,
    public readonly lineNumber: number,
    message: string,
  ) {
    super(message);
    this.name = "EnvFileParseError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export async function readEnvFile(filePath: string): Promise<Record<string, string>> {
  return parseEnvFile(await readFile(filePath, "utf8"), filePath);
}

export function parseEnvFile(
  source: string,
  filePath = ".env",
): Record<string, string> {
  const values: Record<string, string> = {};
  const lines = source.split(/\r?\n/);

  for (let index = 0; index < lines.length; index += 1) {
    const lineNumber = index + 1;
    const rawLine = lines[index] ?? "";
    const line = rawLine.trim();

    if (line === "" || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");

    if (separatorIndex <= 0) {
      throw new EnvFileParseError(
        filePath,
        lineNumber,
        `Invalid env file line ${lineNumber}: expected KEY=value.`,
      );
    }

    const key = line.slice(0, separatorIndex).trim();

    if (!ENV_KEY_PATTERN.test(key)) {
      throw new EnvFileParseError(
        filePath,
        lineNumber,
        `Invalid env file line ${lineNumber}: invalid key "${key}".`,
      );
    }

    values[key] = parseEnvValue(
      line.slice(separatorIndex + 1).trim(),
      filePath,
      lineNumber,
    );
  }

  return values;
}

function parseEnvValue(value: string, filePath: string, lineNumber: number): string {
  if (value.startsWith("\"")) {
    const closingQuoteIndex = findClosingQuote(value, "\"");

    if (closingQuoteIndex <= 0) {
      throw new EnvFileParseError(
        filePath,
        lineNumber,
        `Invalid env file line ${lineNumber}: unterminated double-quoted value.`,
      );
    }

    assertOnlyInlineCommentAfterQuote(value, closingQuoteIndex, filePath, lineNumber);

    return value.slice(1, closingQuoteIndex).replaceAll("\\\"", "\"");
  }

  if (value.startsWith("'")) {
    const closingQuoteIndex = findClosingQuote(value, "'");

    if (closingQuoteIndex <= 0) {
      throw new EnvFileParseError(
        filePath,
        lineNumber,
        `Invalid env file line ${lineNumber}: unterminated single-quoted value.`,
      );
    }

    assertOnlyInlineCommentAfterQuote(value, closingQuoteIndex, filePath, lineNumber);

    return value.slice(1, closingQuoteIndex);
  }

  return stripUnquotedInlineComment(value).trim();
}

function findClosingQuote(value: string, quote: "\"" | "'"): number {
  for (let index = 1; index < value.length; index += 1) {
    if (quote === "\"" && value[index] === "\\" && index + 1 < value.length) {
      index += 1;
      continue;
    }

    if (value[index] === quote) {
      return index;
    }
  }

  return -1;
}

function assertOnlyInlineCommentAfterQuote(
  value: string,
  closingQuoteIndex: number,
  filePath: string,
  lineNumber: number,
): void {
  const remainder = value.slice(closingQuoteIndex + 1).trim();

  if (remainder !== "" && !remainder.startsWith("#")) {
    throw new EnvFileParseError(
      filePath,
      lineNumber,
      `Invalid env file line ${lineNumber}: unexpected text after quoted value.`,
    );
  }
}

function stripUnquotedInlineComment(value: string): string {
  const commentStart = value.search(/\s#/);

  if (commentStart === -1) {
    return value;
  }

  return value.slice(0, commentStart);
}
