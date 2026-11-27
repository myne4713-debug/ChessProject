import fs from 'fs';
import path from 'path';
import { WindowState } from './types';

export interface DisplayWorkArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const DEFAULT_WINDOW_STATE: WindowState = {
  width: 1320,
  height: 860,
  isMaximized: false,
};

export const MIN_WINDOW_WIDTH = 960;
export const MIN_WINDOW_HEIGHT = 680;

function hasVisibleIntersection(bounds: WindowState, area: DisplayWorkArea): boolean {
  if (typeof bounds.x !== 'number' || typeof bounds.y !== 'number') {
    return false;
  }
  const overlapX =
    Math.min(bounds.x + bounds.width, area.x + area.width) - Math.max(bounds.x, area.x);
  const overlapY =
    Math.min(bounds.y + bounds.height, area.y + area.height) - Math.max(bounds.y, area.y);
  return overlapX >= 120 && overlapY >= 80;
}

export function clampWindowBounds(
  saved: Partial<WindowState> | null | undefined,
  displays: DisplayWorkArea[]
): WindowState {
  const primary = displays[0] ?? { x: 0, y: 0, width: 1440, height: 900 };
  const maxWidth = Math.max(MIN_WINDOW_WIDTH, primary.width);
  const maxHeight = Math.max(MIN_WINDOW_HEIGHT, primary.height);

  const width = Math.min(
    maxWidth,
    Math.max(MIN_WINDOW_WIDTH, Number(saved?.width) || DEFAULT_WINDOW_STATE.width)
  );
  const height = Math.min(
    maxHeight,
    Math.max(MIN_WINDOW_HEIGHT, Number(saved?.height) || DEFAULT_WINDOW_STATE.height)
  );
  const isMaximized = Boolean(saved?.isMaximized);

  const candidate: WindowState = {
    x: typeof saved?.x === 'number' && Number.isFinite(saved.x) ? Math.round(saved.x) : undefined,
    y: typeof saved?.y === 'number' && Number.isFinite(saved.y) ? Math.round(saved.y) : undefined,
    width: Math.round(width),
    height: Math.round(height),
    isMaximized,
  };

  if (
    candidate.x !== undefined &&
    candidate.y !== undefined &&
    displays.some((area) => hasVisibleIntersection(candidate, area))
  ) {
    return candidate;
  }

  return {
    x: Math.round(primary.x + Math.max(0, (primary.width - candidate.width) / 2)),
    y: Math.round(primary.y + Math.max(0, (primary.height - candidate.height) / 2)),
    width: candidate.width,
    height: candidate.height,
    isMaximized,
  };
}

export function loadWindowState(filePath: string, displays: DisplayWorkArea[]): WindowState {
  try {
    if (!fs.existsSync(filePath)) {
      return clampWindowBounds(DEFAULT_WINDOW_STATE, displays);
    }
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw) as Partial<WindowState>;
    return clampWindowBounds(parsed, displays);
  } catch {
    return clampWindowBounds(DEFAULT_WINDOW_STATE, displays);
  }
}

export function saveWindowState(filePath: string, state: WindowState): void {
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(state, null, 2), 'utf8');
  } catch {
    // Non-fatal: ignore persistence failure on read-only paths
  }
}
