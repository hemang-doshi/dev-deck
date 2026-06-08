import { DevdeckError } from "@devdeck/config";

import { createDevDeckErrorPayload, type DevDeckErrorPayload, type NextAction } from "../agent-errors.js";
import { createErrorResponse, createSuccessResponse, printJsonResponse } from "../agent-response.js";
import { inspectDevdeckConfig, type ConfigFinding, type ConfigInspectionResult } from "../config-inspector.js";
import { CliUsageError } from "../cli-errors.js";
import type { CommandIo } from "./init.js";

const CONFIG_USAGE = "Usage: devdeck config <validate|explain> [--json]";

export type ConfigCommandOptions = {
  cwd?: string;
  io?: CommandIo;
};

export async function runConfigCommand(
  args: string[],
  options: ConfigCommandOptions = {},
): Promise<boolean> {
  const subcommand = args[0];
  const flags = parseConfigFlags(args.slice(1));

  if (subcommand === "validate") {
    return runConfigValidate(flags, options);
  }

  if (subcommand === "explain") {
    return runConfigExplain(flags, options);
  }

  throw new CliUsageError(CONFIG_USAGE);
}

async function runConfigValidate(
  flags: { json: boolean },
  options: ConfigCommandOptions,
): Promise<boolean> {
  try {
    const inspection = await inspectDevdeckConfig({ cwd: options.cwd });

    if (flags.json) {
      if (inspection.valid) {
        printJsonResponse(
          createSuccessResponse(
            {
              command: "config.validate",
              project: inspection.project,
              summary: `Config is valid: ${inspection.serviceCount} service${inspection.serviceCount === 1 ? "" : "s"}, 0 blocking findings.`,
            },
            inspection,
          ),
          getWriter(options.io),
        );
        return true;
      }

      printJsonResponse(
        createConfigValidationErrorResponse(inspection),
        getWriter(options.io),
      );
      return false;
    }

    if (inspection.valid) {
      writeOutput(
        options.io,
        `Config is valid: ${inspection.serviceCount} service${inspection.serviceCount === 1 ? "" : "s"}, 0 blocking findings.\n`,
      );
      return true;
    }

    writeOutput(options.io, formatFindings(inspection.findings));
    return false;
  } catch (error) {
    if (error instanceof DevdeckError) {
      if (flags.json) {
        printJsonResponse(
          createErrorResponse(
            {
              command: "config.validate",
              summary: "Config validation failed.",
            },
            configErrorPayload(error),
          ),
          getWriter(options.io),
        );
      } else {
        writeOutput(options.io, `[${normalizeConfigErrorCode(error.code)}] ${error.message}\n`);
        if (error.hint) {
          writeOutput(options.io, `Hint: ${error.hint}\n`);
        }
      }
      return false;
    }

    throw error;
  }
}

async function runConfigExplain(
  flags: { json: boolean },
  options: ConfigCommandOptions,
): Promise<boolean> {
  try {
    const inspection = await inspectDevdeckConfig({ cwd: options.cwd });

    if (flags.json) {
      printJsonResponse(
        createSuccessResponse(
          {
            command: "config.explain",
            project: inspection.project,
            summary: `Explained ${inspection.serviceCount} service${inspection.serviceCount === 1 ? "" : "s"} from devdeck.yml.`,
          },
          inspection,
        ),
        getWriter(options.io),
      );
    } else {
      writeOutput(options.io, formatExplanation(inspection));
    }

    return true;
  } catch (error) {
    if (error instanceof DevdeckError) {
      if (flags.json) {
        printJsonResponse(
          createErrorResponse(
            {
              command: "config.explain",
              summary: "Config explain failed.",
            },
            configErrorPayload(error),
          ),
          getWriter(options.io),
        );
      } else {
        writeOutput(options.io, `[${normalizeConfigErrorCode(error.code)}] ${error.message}\n`);
        if (error.hint) {
          writeOutput(options.io, `Hint: ${error.hint}\n`);
        }
      }
      return false;
    }

    throw error;
  }
}

function parseConfigFlags(args: string[]): { json: boolean } {
  let json = false;

  for (const arg of args) {
    if (arg === "--json") {
      json = true;
      continue;
    }

    throw new CliUsageError(`Unknown option: ${arg}`);
  }

  return { json };
}

function createConfigValidationErrorResponse(inspection: ConfigInspectionResult) {
  const blockingFindings = inspection.findings.filter((finding) => finding.severity === "error");
  const nextActions = dedupeNextActions(blockingFindings.flatMap((finding) => finding.nextActions));
  const error = createDevDeckErrorPayload({
    code: "DD_CONFIG_VALIDATION_FAILED",
    message: "Config has blocking validation findings.",
    severity: "error",
    retryable: false,
    evidence: blockingFindings.flatMap((finding) => finding.evidence),
    nextActions,
  });
  const response = createErrorResponse<ConfigInspectionResult>(
    {
      command: "config.validate",
      project: inspection.project,
      summary: `Config has ${blockingFindings.length} blocking finding${blockingFindings.length === 1 ? "" : "s"}.`,
      nextActions,
    },
    error,
  );

  return {
    ...response,
    result: inspection,
  };
}

function configErrorPayload(error: DevdeckError): DevDeckErrorPayload {
  return createDevDeckErrorPayload({
    code: normalizeConfigErrorCode(error.code),
    message: error.message,
    hint: error.hint,
    severity: "error",
    retryable: false,
    evidence: [],
    nextActions: [],
  });
}

function normalizeConfigErrorCode(code: string): string {
  const legacyConfigCodes: Record<string, string> = {
    "DD-ERR-0001": "DD_CONFIG_NOT_FOUND",
    "DD-ERR-0002": "DD_CONFIG_INVALID_YAML",
    "DD-ERR-0003": "DD_CONFIG_INVALID_SCHEMA",
    "DD-ERR-0004": "DD_CONFIG_INVALID_SCHEMA",
    "DD-ERR-0005": "DD_CONFIG_COMMAND_INVALID",
    "DD-ERR-0006": "DD_CONFIG_INVALID_CWD",
    "DD-ERR-0007": "DD_CONFIG_INVALID_CWD",
    "DD-ERR-0008": "DD_CONFIG_INVALID_SCHEMA",
    "DD-ERR-0009": "DD_CONFIG_INVALID_SCHEMA",
  };

  if (code.startsWith("DD_CONFIG_")) {
    return code;
  }

  return legacyConfigCodes[code] ?? "DD_INTERNAL_UNEXPECTED";
}

function formatExplanation(inspection: ConfigInspectionResult): string {
  const lines = [
    `Project: ${inspection.project}`,
    `Config: ${inspection.configPath}`,
    `Services: ${inspection.serviceCount}`,
  ];

  for (const service of inspection.services) {
    lines.push(service.name);
    lines.push(`  cwd: ${service.cwd}`);

    if (service.command) {
      lines.push(`  command: ${service.command}`);
    }

    if (service.exec) {
      lines.push(`  exec: ${service.exec.argv.join(" ")}`);
    }

    if (service.dependencies.length > 0) {
      lines.push(
        `  dependsOn: ${service.dependencies
          .map((dependency) => `${dependency.service} (${dependency.condition})`)
          .join(", ")}`,
      );
    }

    if (service.health) {
      lines.push(`  health: ${formatProbe(service.health)}`);
    }

    if (service.readiness) {
      lines.push(`  readiness: ${formatProbe(service.readiness)}`);
    }

    if (service.env.requiredEnv.length > 0) {
      lines.push(
        `  required env: ${service.env.requiredEnv
          .map((key) => `${key} ${service.env.missing.includes(key) ? "missing" : "satisfied"}`)
          .join(", ")}`,
      );
    }
  }

  if (inspection.findings.length > 0) {
    lines.push(...formatFindingLines(inspection.findings));
  }

  return `${lines.join("\n")}\n`;
}

function formatFindings(findings: ConfigFinding[]): string {
  const blocking = findings.filter((finding) => finding.severity === "error");
  return [
    `Config has ${blocking.length} blocking finding${blocking.length === 1 ? "" : "s"}.`,
    ...formatFindingLines(findings),
    "",
  ].join("\n");
}

function formatFindingLines(findings: ConfigFinding[]): string[] {
  return findings.map((finding) => {
    const service = finding.service ? `${finding.service} ` : "";
    return `[${finding.severity}] ${service}${finding.code}: ${finding.message}`;
  });
}

function formatProbe(probe: unknown): string {
  if (!probe || typeof probe !== "object" || !("type" in probe)) {
    return "configured";
  }

  const typedProbe = probe as Record<string, unknown>;

  if (typedProbe.type === "http" && typeof typedProbe.url === "string") {
    return `http ${typedProbe.url}`;
  }

  if (typedProbe.type === "tcp") {
    const host = typeof typedProbe.host === "string" ? `${typedProbe.host}:` : "";
    return `tcp ${host}${String(typedProbe.port)}`;
  }

  if (typedProbe.type === "log" && typeof typedProbe.pattern === "string") {
    return `log "${typedProbe.pattern}"`;
  }

  if (typedProbe.type === "command" && typeof typedProbe.command === "string") {
    return `command ${typedProbe.command}`;
  }

  return String(typedProbe.type);
}

function dedupeNextActions(nextActions: NextAction[]): NextAction[] {
  const seen = new Set<string>();
  const deduped: NextAction[] = [];

  for (const action of nextActions) {
    const key = JSON.stringify(action);

    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(action);
    }
  }

  return deduped;
}

function writeOutput(io: CommandIo | undefined, message: string): void {
  (io ?? defaultIo).stdout(message);
}

function getWriter(io: CommandIo | undefined): (message: string) => void {
  return (message) => (io ?? defaultIo).stdout(message);
}

const defaultIo: CommandIo = {
  stdout: (message) => process.stdout.write(message),
  stderr: (message) => process.stderr.write(message),
};
