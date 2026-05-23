import type { LogSeverity, SessionSnapshot } from "@devdeck/core";
import { DevdeckError } from "@devdeck/config";
import { DEFAULT_SESSION_URL, resolveSessionBaseUrl } from "./session-state.js";

export type AgentClientOptions = {
  cwd?: string;
  fetchImplementation?: typeof fetch;
  url?: string;
};

export type AgentLogsResponse = {
  project: string;
  filters: {
    service?: string;
    severity?: LogSeverity;
    grep?: string;
    tail: number;
  };
  totalMatched: number;
  returned: number;
  logs: SessionSnapshot["logs"];
};

export async function getSnapshot(options: AgentClientOptions = {}): Promise<SessionSnapshot> {
  return requestJson("/api/snapshot", options);
}

export async function getLogs(
  filters: {
    service?: string;
    tail?: number;
    severity?: LogSeverity;
    grep?: string;
  },
  options: AgentClientOptions = {},
): Promise<AgentLogsResponse> {
  const searchParams = new URLSearchParams();

  if (filters.service) {
    searchParams.set("service", filters.service);
  }

  if (filters.tail !== undefined) {
    searchParams.set("tail", String(filters.tail));
  }

  if (filters.severity) {
    searchParams.set("severity", filters.severity);
  }

  if (filters.grep) {
    searchParams.set("grep", filters.grep);
  }

  const suffix = searchParams.size > 0 ? `?${searchParams.toString()}` : "";
  return requestJson(`/api/logs${suffix}`, options);
}

export async function postAction(
  body: { action: "start" | "stop" | "restart" | "stop-session"; serviceName?: string },
  options: AgentClientOptions = {},
): Promise<{ ok: boolean; error?: string }> {
  return requestJson("/api/actions", {
    ...options,
    method: "POST",
    body,
  });
}

async function requestJson<T>(
  pathname: string,
  options: AgentClientOptions & {
    body?: unknown;
    method?: "GET" | "POST";
  } = {},
): Promise<T> {
  const baseUrl = await resolveSessionBaseUrl({
    cwd: options.cwd,
    url: options.url,
  });
  const fetchImplementation = options.fetchImplementation ?? fetch;
  const url = new URL(pathname, ensureTrailingSlash(baseUrl));

  let response: Response;

  try {
    response = await fetchImplementation(url, {
      method: options.method ?? "GET",
      headers:
        options.body === undefined
          ? undefined
          : {
              "content-type": "application/json",
            },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch (error) {
    throw new DevdeckError(
      "DD-ERR-0012",
      `Unable to reach DevDeck session server at ${baseUrl}.`,
      "Start the session first using 'devdeck start' or 'devdeck dev' in your project root, or verify the '--url' parameter."
    );
  }

  if (!response.ok) {
    const message = await readErrorMessage(response);
    throw new Error(message);
  }

  return (await response.json()) as T;
}

function ensureTrailingSlash(url: string): string {
  return url.endsWith("/") ? url : `${url}/`;
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: string };
    if (body.error) {
      return body.error;
    }
  } catch {
    // Ignore invalid JSON and fall through to text.
  }

  const text = await response.text();
  return text || `Agent DevDeck request failed (${response.status})`;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return `Falling back to default session URL ${DEFAULT_SESSION_URL}.`;
}
