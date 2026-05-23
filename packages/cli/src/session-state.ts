import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_SESSION_URL = "http://127.0.0.1:4545";

export type RuntimeSessionState = {
  version: 1;
  project: string;
  configPath: string;
  url: string;
  port: number;
  pid: number;
  startedAt: string;
};

export async function writeSessionState(options: {
  cwd?: string;
  session: RuntimeSessionState;
}): Promise<void> {
  const sessionPath = resolveSessionStatePath(options.cwd);
  await mkdir(path.dirname(sessionPath), { recursive: true });
  await writeFile(sessionPath, JSON.stringify(options.session, null, 2), "utf8");
}

export async function readSessionState(cwd?: string): Promise<RuntimeSessionState> {
  const sessionPath = resolveSessionStatePath(cwd);
  const contents = await readFile(sessionPath, "utf8");
  return JSON.parse(contents) as RuntimeSessionState;
}

export async function clearSessionState(cwd?: string): Promise<void> {
  await rm(resolveSessionStatePath(cwd), { force: true });
}

export async function resolveSessionBaseUrl(options: {
  cwd?: string;
  url?: string;
}): Promise<string> {
  if (options.url) {
    return options.url;
  }

  try {
    const state = await readSessionState(options.cwd);
    return state.url;
  } catch {
    return DEFAULT_SESSION_URL;
  }
}

export function resolveSessionStatePath(cwd?: string): string {
  return path.join(path.resolve(cwd ?? process.cwd()), ".devdeck/session.json");
}
