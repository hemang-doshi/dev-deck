import { readFile } from "node:fs/promises";
import path from "node:path";

export async function loadDashboardAsset(
  assetsDirectory: string,
  requestPath: string,
): Promise<{ body: Buffer; contentType: string }> {
  const relativePath = requestPath === "/" ? "index.html" : requestPath.replace(/^\//, "");
  const assetPath = path.join(assetsDirectory, relativePath);
  const body = await readFile(assetPath);

  return {
    body,
    contentType: getContentType(assetPath),
  };
}

function getContentType(assetPath: string): string {
  if (assetPath.endsWith(".html")) {
    return "text/html; charset=utf-8";
  }

  if (assetPath.endsWith(".js")) {
    return "application/javascript; charset=utf-8";
  }

  if (assetPath.endsWith(".css")) {
    return "text/css; charset=utf-8";
  }

  if (assetPath.endsWith(".json")) {
    return "application/json; charset=utf-8";
  }

  if (assetPath.endsWith(".svg")) {
    return "image/svg+xml";
  }

  if (assetPath.endsWith(".png")) {
    return "image/png";
  }

  if (assetPath.endsWith(".ico")) {
    return "image/x-icon";
  }

  return "application/octet-stream";
}
