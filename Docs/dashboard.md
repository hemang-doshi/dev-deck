# Using the DevDeck Dashboard

The DevDeck Dashboard is served locally at `http://127.0.0.1:4545`. It provides an interactive grid dashboard to control, monitor, and copy developer session information.

---

## 1. Grid Workspace Customization

The workspace is a responsive 12-column grid layout designed for drag-and-drop orchestration.

- **Drag-and-Drop:** Hover over the top bar of any service card and drag it to rearrange cards.
- **Card Resizing:** Use the size selector on individual cards to switch widths:
  - **Full Width:** Spans all 12 columns (best for heavy log streams).
  - **Half Width:** Spans 6 columns.
  - **Third Width:** Spans 4 columns (ideal for static indicators or simple log tracking).
- **Themes & Colors:** Click the color circle on any service card to select from 5 custom high-contrast glow colors (Slate, Sky, Mint, Rose, or Amber). This helps visually group or separate logs (e.g., setting databases to Amber and web servers to Mint).
- **Persistence:** All grid positioning, card widths, and color themes are stored automatically in your browser's `localStorage` isolated by project name.

---

## 2. Real-Time Log Navigation

The main pane of each card acts as a high-fidelity scrollable log area.

- **Live Autoscroll:** Logs scroll down automatically as new stdout/stderr lines arrive.
- **Manual Interruption:** Scrolling up pauses autoscroll, allowing you to read historical lines without getting jumped to the bottom. Click the "Scroll to Bottom" indicator to resume.
- **Classification & Highlighting:** The log view scans incoming text and colorizes keywords:
  - `ERROR` lines flash or display with red highlight.
  - `WARNING` lines highlight in amber/yellow.
  - Links, ports, and URLs are auto-hyperlinked for one-click access.

---

## 3. Log Searching and Filtering

Use the header search and filter controls to isolate events:
- **Global Search:** Type keywords in the header bar to filter lines matching the query across all active service panels.
- **Group Filter:** If your `devdeck.yml` contains `group` keys, filter cards by selecting the group from the navigation tab.
- **Severity Filters:** Toggle visibility for specific logs severity levels (e.g. only show errors or warnings).

---

## 4. Service Orchestration Actions

From the header toolbar of any service card, you can issue commands directly to the backend process runner:
- **Stop:** Terminates the service command execution tree.
- **Start:** Launches the service command if it is stopped.
- **Restart:** Restarts the service, clearing its local log screen buffer.

---

## 5. Debug Context Handoff

One of DevDeck's most powerful features is **Single-Click Handoff** for AI-assisted debugging:
- Click the **"Copy Debug Context"** button in the dashboard header.
- This packages:
  - Current project metadata.
  - Healthy, warning, and crashed service lists.
  - Process exit codes.
  - The last 50 lines of logs for any services that are in warning or error states.
- The context is copied as a clean markdown block, ready to be pasted directly into an AI coding assistant (like Claude or Gemini) or a GitHub Issue report to fix errors quickly.
- Alternatively, use the **"Export"** action to download the entire session log context as a raw text log file.
