import type { DashboardLog, DashboardService } from "./session-client";

export const WORKSPACE_LAYOUT_VERSION = 1;

export const TILE_COLORS = ["slate", "sky", "mint", "amber", "rose"] as const;
export const TILE_SIZES = ["sm", "md", "lg"] as const;

export type WorkspaceTileColor = (typeof TILE_COLORS)[number];
export type WorkspaceTileSize = (typeof TILE_SIZES)[number];
export type WorkspaceTileScopeType = "unified" | "group" | "service";

export type WorkspaceTile = {
  id: string;
  scopeType: WorkspaceTileScopeType;
  scopeId: string;
  size: WorkspaceTileSize;
  color: WorkspaceTileColor;
  order: number;
};

export type WorkspaceState = {
  version: number;
  tiles: WorkspaceTile[];
};

export function createDefaultWorkspace(): WorkspaceState {
  return {
    version: WORKSPACE_LAYOUT_VERSION,
    tiles: [
      {
        id: "unified",
        scopeType: "unified",
        scopeId: "all",
        size: "lg",
        color: "slate",
        order: 0,
      },
    ],
  };
}

export function getWorkspaceStorageKey(project: string): string {
  return `devdeck.workspace.${project}`;
}

export function sanitizeWorkspaceState(
  candidate: unknown,
  services: DashboardService[],
): WorkspaceState {
  if (
    !isRecord(candidate) ||
    candidate.version !== WORKSPACE_LAYOUT_VERSION ||
    !Array.isArray(candidate.tiles)
  ) {
    return createDefaultWorkspace();
  }

  const source = candidate.tiles;
  const availableServices = new Set(services.map((service) => service.name));
  const availableGroups = new Set(
    services.flatMap((service) => (service.group ? [service.group] : [])),
  );
  const seenScopes = new Set<string>();
  const nextTiles: WorkspaceTile[] = [];

  for (const tile of source) {
    const normalized = normalizeTile(tile);

    if (!normalized) {
      continue;
    }

    if (!isTileScopeValid(normalized, availableServices, availableGroups)) {
      continue;
    }

    const scopeKey = `${normalized.scopeType}:${normalized.scopeId}`;

    if (seenScopes.has(scopeKey)) {
      continue;
    }

    seenScopes.add(scopeKey);
    nextTiles.push(normalized);
  }

  return {
    version: WORKSPACE_LAYOUT_VERSION,
    tiles: sortAndReindexTiles(nextTiles),
  };
}

export function sortAndReindexTiles(tiles: WorkspaceTile[]): WorkspaceTile[] {
  return [...tiles]
    .sort((left, right) => left.order - right.order)
    .map((tile, index) => ({ ...tile, order: index }));
}

export function addWorkspaceTile(
  state: WorkspaceState,
  scopeType: WorkspaceTileScopeType,
  scopeId: string,
): WorkspaceState {
  const tileId = scopeType === "unified" ? "unified" : `${scopeType}:${scopeId}`;
  if (state.tiles.some((tile) => tile.id === tileId)) {
    return state;
  }

  const nextOrder = state.tiles.length;
  const nextColor = TILE_COLORS[nextOrder % TILE_COLORS.length] ?? "slate";

  return {
    ...state,
    tiles: [
      ...state.tiles,
      {
        id: tileId,
        scopeType,
        scopeId,
        size: scopeType === "unified" ? "lg" : scopeType === "group" ? "md" : "sm",
        color: nextColor,
        order: nextOrder,
      },
    ],
  };
}

export function removeWorkspaceTile(state: WorkspaceState, tileId: string): WorkspaceState {
  const tile = state.tiles.find((entry) => entry.id === tileId);

  if (!tile) {
    return state;
  }

  return {
    ...state,
    tiles: sortAndReindexTiles(state.tiles.filter((entry) => entry.id !== tileId)),
  };
}

export function cycleTileColor(state: WorkspaceState, tileId: string): WorkspaceState {
  return {
    ...state,
    tiles: state.tiles.map((tile) => {
      if (tile.id !== tileId) {
        return tile;
      }

      const currentIndex = TILE_COLORS.indexOf(tile.color);
      const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % TILE_COLORS.length;
      return { ...tile, color: TILE_COLORS[nextIndex] ?? "slate" };
    }),
  };
}

export function cycleTileSize(state: WorkspaceState, tileId: string): WorkspaceState {
  return {
    ...state,
    tiles: state.tiles.map((tile) => {
      if (tile.id !== tileId) {
        return tile;
      }

      const currentIndex = TILE_SIZES.indexOf(tile.size);
      const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % TILE_SIZES.length;
      return { ...tile, size: TILE_SIZES[nextIndex] ?? "sm" };
    }),
  };
}

export function reorderWorkspaceTiles(
  state: WorkspaceState,
  sourceId: string,
  targetId: string,
): WorkspaceState {
  if (sourceId === targetId) {
    return state;
  }

  const ordered = sortAndReindexTiles(state.tiles);
  const sourceIndex = ordered.findIndex((tile) => tile.id === sourceId);
  const targetIndex = ordered.findIndex((tile) => tile.id === targetId);

  if (sourceIndex === -1 || targetIndex === -1) {
    return state;
  }

  const nextTiles = [...ordered];
  const [moved] = nextTiles.splice(sourceIndex, 1);

  if (!moved) {
    return state;
  }

  nextTiles.splice(targetIndex, 0, moved);

  return {
    ...state,
    tiles: nextTiles.map((tile, index) => ({ ...tile, order: index })),
  };
}

export function getTileTitle(tile: WorkspaceTile): string {
  if (tile.scopeType === "unified") {
    return "Unified stream";
  }

  if (tile.scopeType === "group") {
    return `${tile.scopeId} group`;
  }

  return tile.scopeId;
}

export function getTileSubtitle(tile: WorkspaceTile): string {
  if (tile.scopeType === "unified") {
    return "Shared session filters";
  }

  if (tile.scopeType === "group") {
    return "All services in this group";
  }

  return "Single service scope";
}

export function getTileServices(
  tile: WorkspaceTile,
  services: DashboardService[],
): DashboardService[] {
  if (tile.scopeType === "unified") {
    return services;
  }

  if (tile.scopeType === "group") {
    return services.filter((service) => service.group === tile.scopeId);
  }

  return services.filter((service) => service.name === tile.scopeId);
}

export function filterLogsForTile(
  tile: WorkspaceTile,
  logs: DashboardLog[],
  services: DashboardService[],
): DashboardLog[] {
  if (tile.scopeType === "unified") {
    return logs;
  }

  const serviceNames = new Set(getTileServices(tile, services).map((service) => service.name));
  return logs.filter((log) => serviceNames.has(log.service));
}

export function listServiceGroups(services: DashboardService[]): string[] {
  return [...new Set(services.flatMap((service) => (service.group ? [service.group] : [])))].sort();
}

function normalizeTile(candidate: unknown): WorkspaceTile | null {
  if (!isRecord(candidate)) {
    return null;
  }

  if (
    typeof candidate.id !== "string" ||
    !isTileScopeType(candidate.scopeType) ||
    typeof candidate.scopeId !== "string" ||
    !isTileSize(candidate.size) ||
    !isTileColor(candidate.color) ||
    typeof candidate.order !== "number"
  ) {
    return null;
  }

  return {
    id: candidate.id,
    scopeType: candidate.scopeType,
    scopeId: candidate.scopeId,
    size: candidate.size,
    color: candidate.color,
    order: candidate.order,
  };
}

function isTileScopeValid(
  tile: WorkspaceTile,
  services: Set<string>,
  groups: Set<string>,
): boolean {
  if (tile.scopeType === "unified") {
    return true;
  }

  if (tile.scopeType === "service") {
    return services.has(tile.scopeId);
  }

  return groups.has(tile.scopeId);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isTileScopeType(value: unknown): value is WorkspaceTileScopeType {
  return value === "unified" || value === "group" || value === "service";
}

function isTileSize(value: unknown): value is WorkspaceTileSize {
  return TILE_SIZES.includes(value as WorkspaceTileSize);
}

function isTileColor(value: unknown): value is WorkspaceTileColor {
  return TILE_COLORS.includes(value as WorkspaceTileColor);
}
