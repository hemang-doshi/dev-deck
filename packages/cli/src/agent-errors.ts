export type DevDeckErrorSeverity = "info" | "warning" | "error" | "fatal";

export type Evidence =
  | { type: "config"; path: string; field?: string; value?: unknown }
  | { type: "process"; pid?: number; command?: string; exitCode?: number | null }
  | { type: "port"; host: string; port: number; ownerPid?: number }
  | { type: "log"; service: string; eventId?: string; lines: string[] }
  | { type: "health"; service: string; check: string; result: string }
  | { type: "session"; path?: string; pid?: number; url?: string; reason?: string };

export type NextAction =
  | { type: "command"; command: string; reason: string }
  | { type: "edit_file"; path: string; reason: string }
  | { type: "open_url"; url: string; reason: string }
  | { type: "manual"; description: string; reason: string };

export type DevDeckErrorPayload = {
  code: string;
  message: string;
  severity: DevDeckErrorSeverity;
  retryable: boolean;
  evidence: Evidence[];
  nextActions: NextAction[];
  hint?: string;
  service?: string | null;
};

export type DevDeckErrorInput = {
  code: string;
  message: string;
  severity?: DevDeckErrorSeverity;
  retryable?: boolean;
  evidence?: Evidence[];
  nextActions?: NextAction[];
  hint?: string;
  service?: string | null;
};

export function createDevDeckErrorPayload(input: DevDeckErrorInput): DevDeckErrorPayload {
  return {
    code: input.code,
    message: input.message,
    severity: input.severity ?? "error",
    retryable: input.retryable ?? false,
    evidence: input.evidence ?? [],
    nextActions: input.nextActions ?? [],
    ...(input.hint === undefined ? {} : { hint: input.hint }),
    ...(input.service === undefined ? {} : { service: input.service }),
  };
}
