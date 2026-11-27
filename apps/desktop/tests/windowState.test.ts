import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  clampWindowBounds,
  DEFAULT_WINDOW_STATE,
  loadWindowState,
  MIN_WINDOW_HEIGHT,
  MIN_WINDOW_WIDTH,
  saveWindowState,
} from '../src/windowState';

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    fs.rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe('Desktop Window State Persistence & Clamping', () => {
  const primaryDisplay = { x: 0, y: 0, width: 1920, height: 1080 };
  const secondaryDisplay = { x: 1920, y: 0, width: 1920, height: 1080 };

  it('centers default bounds when no saved state exists', () => {
    const bounds = clampWindowBounds(null, [primaryDisplay]);
    expect(bounds.width).toBe(DEFAULT_WINDOW_STATE.width);
    expect(bounds.height).toBe(DEFAULT_WINDOW_STATE.height);
    expect(bounds.x).toBe(Math.round((1920 - DEFAULT_WINDOW_STATE.width) / 2));
    expect(bounds.y).toBe(Math.round((1080 - DEFAULT_WINDOW_STATE.height) / 2));
  });

  it('keeps valid window coordinates on a connected secondary monitor', () => {
    const saved = { x: 2100, y: 120, width: 1200, height: 800, isMaximized: false };
    const bounds = clampWindowBounds(saved, [primaryDisplay, secondaryDisplay]);
    expect(bounds).toEqual(saved);
  });

  it('recovers off-screen coordinates after an external monitor is disconnected', () => {
    const saved = { x: 2500, y: 100, width: 1280, height: 820, isMaximized: false };
    const bounds = clampWindowBounds(saved, [primaryDisplay]);
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x! + bounds.width).toBeLessThanOrEqual(primaryDisplay.width);
  });

  it('enforces minimum window dimensions and clamps to small displays', () => {
    const bounds = clampWindowBounds(
      { x: 10, y: 10, width: 320, height: 240, isMaximized: false },
      [{ x: 0, y: 0, width: 1280, height: 720 }]
    );
    expect(bounds.width).toBe(MIN_WINDOW_WIDTH);
    expect(bounds.height).toBe(MIN_WINDOW_HEIGHT);
  });

  it('saves and loads window state from disk', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'online-chess-win-'));
    tempDirs.push(dir);
    const filePath = path.join(dir, 'window-state.json');

    saveWindowState(filePath, { x: 150, y: 90, width: 1360, height: 880, isMaximized: true });
    const loaded = loadWindowState(filePath, [primaryDisplay]);
    expect(loaded).toEqual({ x: 150, y: 90, width: 1360, height: 880, isMaximized: true });
  });
});
