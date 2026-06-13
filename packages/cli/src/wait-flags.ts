import { CliUsageError } from "./cli-errors.js";

export const DEFAULT_AGENT_WAIT_SECONDS = 30;
export const DEFAULT_START_WAIT_SECONDS = 10;

export type OptionalWaitFlag = {
  specified: boolean;
  seconds?: number;
};

export function parseOptionalWaitFlag(
  args: string[],
  index: number,
): { flag: OptionalWaitFlag; consumed: number } {
  const next = args[index + 1];

  if (!next || next.startsWith("--")) {
    return {
      flag: {
        specified: true,
      },
      consumed: 0,
    };
  }

  return {
    flag: {
      specified: true,
      seconds: parseWaitValue(next),
    },
    consumed: 1,
  };
}

export function parseWaitValue(raw: string | undefined): number {
  if (!raw) {
    throw new CliUsageError("Missing value for --wait.");
  }

  const parsed = Number.parseInt(raw, 10);
  if (!/^\d+$/.test(raw) || !Number.isInteger(parsed) || parsed < 0 || parsed > 300) {
    throw new CliUsageError("Invalid --wait value. Expected an integer from 0 to 300 seconds.");
  }

  return parsed;
}

export function resolveStartWaitSeconds(options: {
  agent: boolean;
  waitFlag: OptionalWaitFlag;
}): number {
  if (options.waitFlag.seconds !== undefined) {
    return options.waitFlag.seconds;
  }

  if (options.agent || options.waitFlag.specified) {
    return DEFAULT_AGENT_WAIT_SECONDS;
  }

  return DEFAULT_START_WAIT_SECONDS;
}

export function resolveServiceWaitSeconds(options: {
  agent: boolean;
  waitFlag: OptionalWaitFlag;
}): number {
  if (options.waitFlag.seconds !== undefined) {
    return options.waitFlag.seconds;
  }

  if (options.agent || options.waitFlag.specified) {
    return DEFAULT_AGENT_WAIT_SECONDS;
  }

  return 0;
}

export function resolveRecoverWaitSeconds(options: {
  agent: boolean;
  json: boolean;
  waitFlag: OptionalWaitFlag;
}): number {
  if (options.waitFlag.seconds !== undefined) {
    return options.waitFlag.seconds;
  }

  if (options.agent || options.json || options.waitFlag.specified) {
    return DEFAULT_AGENT_WAIT_SECONDS;
  }

  return 0;
}
