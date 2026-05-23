# Troubleshooting & Common Issues

This guide provides solutions for common error scenarios encountered when configuring or running DevDeck.

---

## 1. Port Configuration Conflicts

### Issue: "Address already in use" (dashboard server fails to start)
By default, DevDeck hosts the dashboard on port `4545`. If another local service is listening on port `4545`, launching DevDeck will fail.

**Solution:**
Launch the dashboard on a custom port using the `--port` flag:
```bash
devdeck dev --port 8888
```

### Issue: Service Port Health Checks constantly fail
If a service is running but is shown as "unhealthy" (yellow/red dot instead of green) in the dashboard, the port health checker may not be able to reach it.

**Solutions:**
1. Check that the `port` key in `devdeck.yml` matches the port your service actually binds to at runtime.
2. Verify the service is binding to localhost interfaces (`127.0.0.1` or `0.0.0.0`). If the service binds exclusively to an external network IP, the localhost health check might fail.
3. Ensure the service command has fully loaded and is not stuck in a startup crash loop.

---

## 2. Process Runner and CWD Errors

### Issue: "ConfigError: Expected service cwd to exist"
During startup, DevDeck validates that all service working directories (`cwd`) exist. If you see this error, it means the relative path defined in `cwd` is incorrect.

**Solution:**
1. Remember that `cwd` is relative to the directory where the `devdeck.yml` file is located, **not** your terminal's current working directory.
2. Confirm the directory spelling and layout.
3. Use `.` if the service command should be run directly in the config directory.

### Issue: Command not found or command exits immediately
If a service panel shows `exited with code X` immediately upon starting.

**Solutions:**
1. Ensure the command binaries (e.g. `npm`, `python`, `docker`) are available in your system's global environment PATH.
2. Double check script names. For example, if you run `python main.py`, verify that `main.py` is present in the specified `cwd` directory.
3. Check the exit code:
   - **Exit Code 127:** The command command was not found (path issue).
   - **Exit Code 1:** General runtime script crash (check the error logs printed in the service panel).

---

## 3. WebSocket Disconnection

### Issue: Dashboard shows "Disconnected" or fails to load log lines
If the dashboard UI opens in your browser but shows a red "Disconnected" state in the header.

**Solutions:**
1. Verify the CLI runner is still running in your terminal. If the CLI command was terminated, the backend server will shut down.
2. Check for local firewalls or VPN routing rules blocking loopback connections on WebSocket endpoints (`ws://127.0.0.1:4545`).
3. Reload the browser tab to force a WebSocket reconnection.

---

## 4. Zombie (Orphaned) Processes

### Issue: Background processes keep running after stopping the CLI
If you terminate the DevDeck CLI but discover that the child services (like backend servers or webpack compilation processes) are still listening on their ports.

**Solutions:**
1. DevDeck attempts to kill child process trees gracefully using `SIGINT`/`SIGTERM` on shutdown. However, certain wrapper shell commands (like double shell scripts) might lose process tree attachments.
2. Kill the hanging processes manually using terminal signals (e.g. `kill -9 $(lsof -t -i:<port>)`).
3. Simplify service commands. Avoid nested shell scripts where possible, letting DevDeck call the executable directly.

---

## 5. Diagnostic Error Codes Reference (DD-ERR-XXXX)

DevDeck uses structured error codes printed to stderr to allow human developers and LLM agents to resolve misconfigurations and issues autonomously.

| Error Code | Title | Troubleshooting Hint / Suggestion |
|---|---|---|
| `DD-ERR-0001` | Config file not found | Run `devdeck init` to create a starter `devdeck.yml` file in the current directory. |
| `DD-ERR-0002` | Invalid YAML syntax | Fix YAML syntax errors (e.g., indentation or missing colons) in `devdeck.yml`. |
| `DD-ERR-0003` | Duplicate service name | Ensure all service keys under `services` in `devdeck.yml` are unique. |
| `DD-ERR-0004` | Invalid config schema | Verify the layout of `devdeck.yml`. It must define a `project` name and a `services` map. |
| `DD-ERR-0005` | Missing service command | Define a non-empty `command` string for the reported service in `devdeck.yml`. |
| `DD-ERR-0006` | Missing service cwd | Define a non-empty `cwd` path specifying the working directory for the service in `devdeck.yml`. |
| `DD-ERR-0007` | cwd does not exist | Create the directory or correct the `cwd` path in `devdeck.yml`. |
| `DD-ERR-0008` | Invalid service group | Correct the `group` property. It must be a non-empty string. |
| `DD-ERR-0009` | Invalid service port | Correct the `port` property. It must be a positive integer. |
| `DD-ERR-0010` | Port already in use | Specify a different port using `--port <number>` or stop the process running on that port. |
| `DD-ERR-0011` | Service execution crashed | Run `devdeck logs <service>` to see the exact logs and crash reason. |
| `DD-ERR-0012` | Session server unreachable | Start the session first using `devdeck start` or `devdeck dev`. |
| `DD-ERR-0013` | Session already running | A background DevDeck process is already running. Run `devdeck stop` first. |
| `DD-ERR-0014` | Background startup timeout | Check the background daemon logs at `.devdeck/devdeck.log` for logs. |
| `DD-ERR-0015` | Session server startup failure | Ensure your network configuration allows binding on localhost interfaces. |

