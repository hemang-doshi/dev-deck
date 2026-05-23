import { describe, expect, it } from "vitest";

import {
  addWorkspaceTile,
  createDefaultWorkspace,
  reorderWorkspaceTiles,
  sanitizeWorkspaceState,
} from "../lib/workspace-state";

describe("workspace-state", () => {
  it("reorders tiles by target position", () => {
    let state = createDefaultWorkspace();
    state = addWorkspaceTile(state, "group", "backend");
    state = addWorkspaceTile(state, "service", "web");

    const reordered = reorderWorkspaceTiles(state, "service:web", "group:backend");

    expect(reordered.tiles.map((tile) => [tile.id, tile.order])).toEqual([
      ["unified", 0],
      ["service:web", 1],
      ["group:backend", 2],
    ]);
  });

  it("drops stale service and group tiles during sanitization", () => {
    const sanitized = sanitizeWorkspaceState(
      {
        version: 1,
        tiles: [
          { id: "unified", scopeType: "unified", scopeId: "all", size: "lg", color: "slate", order: 0 },
          { id: "group:backend", scopeType: "group", scopeId: "backend", size: "md", color: "sky", order: 1 },
          { id: "service:web", scopeType: "service", scopeId: "web", size: "sm", color: "mint", order: 2 },
        ],
      },
      [],
    );

    expect(sanitized.tiles).toEqual([
      { id: "unified", scopeType: "unified", scopeId: "all", size: "lg", color: "slate", order: 0 },
    ]);
  });
});
