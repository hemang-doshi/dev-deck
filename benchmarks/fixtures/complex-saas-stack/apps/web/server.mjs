import http from "node:http";

import {
  fetchJson,
  loadFixtureEnv,
  log,
  logError,
  recordServicePid,
} from "../../scripts/lib/runtime.mjs";

const serviceName = "web";
await recordServicePid(serviceName);
const env = await loadFixtureEnv();
const port = Number(env.WEB_PORT ?? "3000");
const apiBaseUrl = `http://127.0.0.1:${Number(env.API_PORT ?? "4000")}`;

const homePage = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Complex SaaS Fixture</title>
    <style>
      body { font-family: ui-sans-serif, system-ui, sans-serif; margin: 40px; line-height: 1.5; }
      main { max-width: 720px; }
      button { padding: 10px 16px; font-size: 16px; }
      pre { background: #0f172a; color: #e2e8f0; padding: 16px; border-radius: 8px; overflow: auto; }
    </style>
  </head>
  <body>
    <main>
      <h1>Complex SaaS Fixture</h1>
      <p>This page proxies a small dashboard call through the web server to the API.</p>
      <button id="load-dashboard">Load Dashboard</button>
      <pre id="output">idle</pre>
    </main>
    <script>
      const output = document.getElementById("output");
      document.getElementById("load-dashboard").addEventListener("click", async () => {
        output.textContent = "loading...";
        try {
          const response = await fetch("/dashboard");
          const payload = await response.text();
          output.textContent = payload;
        } catch (error) {
          output.textContent = error.message;
        }
      });
    </script>
  </body>
</html>`;

const server = http.createServer(async (request, response) => {
  if (request.url === "/") {
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(homePage);
    return;
  }

  if (request.url === "/healthz") {
    try {
      const api = await fetchJson(`${apiBaseUrl}/health/live`);
      response.writeHead(api.response.ok ? 200 : 503, { "content-type": "application/json" });
      response.end(JSON.stringify({ ok: api.response.ok, upstream: "api" }));
      return;
    } catch (error) {
      logError(serviceName, `health proxy failure: ${error.message}`);
      response.writeHead(503, { "content-type": "application/json" });
      response.end(JSON.stringify({ ok: false, error: error.message }));
      return;
    }
  }

  if (request.url === "/dashboard") {
    try {
      const api = await fetchJson(`${apiBaseUrl}/api/dashboard`);
      if (!api.response.ok) {
        logError(serviceName, `api proxy failure: dashboard returned ${api.response.status}`);
      }
      response.writeHead(api.response.status, { "content-type": "application/json" });
      response.end(api.text);
      return;
    } catch (error) {
      logError(serviceName, `request failure while proxying dashboard: ${error.message}`);
      response.writeHead(502, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: error.message }));
      return;
    }
  }

  response.writeHead(404, { "content-type": "application/json" });
  response.end(JSON.stringify({ error: "not found" }));
});

server.on("listening", () => {
  log(serviceName, `web listening on http://127.0.0.1:${port}`);
  log(serviceName, "web ready");
});

server.on("error", (error) => {
  logError(serviceName, `server error: ${error.message}`);
  process.exitCode = 1;
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    log(serviceName, `shutting down after ${signal}`);
    server.close(() => process.exit(0));
  });
}

server.listen(port, "127.0.0.1");
