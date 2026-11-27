import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_SERVER_URL,
  DesktopSettingsStore,
  getDefaultSettings,
  normalizeServerUrl,
} from '../src/settingsStore';

const tempDirs: string[] = [];

function createTempFile(filename = 'desktop-settings.json'): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'online-chess-desktop-'));
  tempDirs.push(dir);
  return path.join(dir, filename);
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop()!;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('Desktop Settings Store', () => {
  it('normalizes valid HTTP/HTTPS server URLs and strips trailing slashes', () => {
    expect(normalizeServerUrl('http://localhost:4000/')).toBe('http://localhost:4000');
    expect(normalizeServerUrl('  https://chess.example.com///  ')).toBe('https://chess.example.com');
    expect(normalizeServerUrl('https://chess.example.com/subpath/')).toBe(
      'https://chess.example.com/subpath'
    );
  });

  it('rejects empty, malformed, or unsafe protocol URLs', () => {
    expect(() => normalizeServerUrl('')).toThrow();
    expect(() => normalizeServerUrl('not-a-url')).toThrow();
    expect(() => normalizeServerUrl('file:///etc/passwd')).toThrow();
    expect(() => normalizeServerUrl('javascript:alert(1)')).toThrow();
    expect(() => normalizeServerUrl('ftp://chess.example.com')).toThrow();
  });

  it('returns sensible defaults and respects ONLINE_CHESS_SERVER_URL', () => {
    const defaults = getDefaultSettings({});
    expect(defaults.serverUrl).toBe(DEFAULT_SERVER_URL);
    expect(defaults.minimizeToTray).toBe(false);
    expect(defaults.notificationsEnabled).toBe(true);
    expect(defaults.theme).toBe('light');

    const withEnv = getDefaultSettings({
      ONLINE_CHESS_SERVER_URL: 'https://arena.onlinechess.app/',
    });
    expect(withEnv.serverUrl).toBe('https://arena.onlinechess.app');
  });

  it('persists updated settings to disk and reloads them cleanly', () => {
    const filePath = createTempFile();
    const store = new DesktopSettingsStore(filePath, {});

    const updated = store.update({
      serverUrl: 'https://play.onlinechess.dev/',
      minimizeToTray: true,
      notificationsEnabled: false,
      theme: 'dark',
    });

    expect(updated).toEqual({
      serverUrl: 'https://play.onlinechess.dev',
      minimizeToTray: true,
      notificationsEnabled: false,
      flashTaskbar: true,
      theme: 'dark',
    });

    const reloaded = new DesktopSettingsStore(filePath, {});
    expect(reloaded.get()).toEqual(updated);
  });

  it('falls back to defaults when the settings file contains corrupted JSON', () => {
    const filePath = createTempFile();
    fs.writeFileSync(filePath, '{ invalid json', 'utf8');

    const store = new DesktopSettingsStore(filePath, {});
    expect(store.get().serverUrl).toBe(DEFAULT_SERVER_URL);
  });
});
