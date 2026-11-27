import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { FALLBACK_SERVER_URL, loadBakedBuildConfig } from '../src/buildConfig';
import { DesktopSettingsStore, getDefaultSettings } from '../src/settingsStore';

const { parseEnvFile, normalizeUrl } = require('../scripts/load-env.cjs');

const tempDirs: string[] = [];

function createTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'online-chess-env-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    fs.rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe('Desktop Build-Time .env & Baked Config', () => {
  it('parses .env files with comments, quotes, and blank lines', () => {
    const dir = createTempDir();
    const envPath = path.join(dir, '.env');
    fs.writeFileSync(
      envPath,
      [
        '# Comment line',
        '',
        'DESKTOP_SERVER_URL="https://chess.example.com/"',
        "VITE_GOOGLE_CLIENT_ID='abc-123'",
      ].join('\n'),
      'utf8'
    );

    const parsed = parseEnvFile(envPath);
    expect(parsed.DESKTOP_SERVER_URL).toBe('https://chess.example.com/');
    expect(parsed.VITE_GOOGLE_CLIENT_ID).toBe('abc-123');
    expect(normalizeUrl(parsed.DESKTOP_SERVER_URL)).toBe('https://chess.example.com');
  });

  it('loads baked build-config.json and uses it as default server URL in settingsStore', () => {
    const dir = createTempDir();
    const configPath = path.join(dir, 'build-config.json');
    const settingsPath = path.join(dir, 'desktop-settings.json');

    fs.writeFileSync(
      configPath,
      JSON.stringify({ defaultServerUrl: 'https://api.onlinechess.vn/' }),
      'utf8'
    );

    const baked = loadBakedBuildConfig(configPath);
    expect(baked.defaultServerUrl).toBe('https://api.onlinechess.vn');

    const defaults = getDefaultSettings({}, baked.defaultServerUrl);
    expect(defaults.serverUrl).toBe('https://api.onlinechess.vn');

    const store = new DesktopSettingsStore(settingsPath, {}, baked.defaultServerUrl);
    expect(store.getDefaultServerUrl()).toBe('https://api.onlinechess.vn');
    expect(store.get().serverUrl).toBe('https://api.onlinechess.vn');
  });

  it('falls back safely when build-config.json does not exist', () => {
    const dir = createTempDir();
    const baked = loadBakedBuildConfig(path.join(dir, 'missing.json'));
    expect(baked.defaultServerUrl).toBe(FALLBACK_SERVER_URL);
  });
});
