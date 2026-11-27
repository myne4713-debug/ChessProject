import { afterEach, beforeEach, describe, expect, it } from 'vitest';

class LocalStorageMock {
  private store: Record<string, string> = {};
  getItem(key: string) {
    return this.store[key] ?? null;
  }
  setItem(key: string, value: string) {
    this.store[key] = value.toString();
  }
  removeItem(key: string) {
    delete this.store[key];
  }
  clear() {
    this.store = {};
  }
}

(globalThis as any).localStorage = new LocalStorageMock();

import {
  buildShareInviteLink,
  isElectronDesktop,
  parseDesktopAuthCallback,
  resolveApiBaseUrl,
  resolveSocketBaseUrl,
  setStoredDesktopServerUrl,
} from '../src/lib/desktop';

describe('Web App: Electron Desktop Bridge Helpers', () => {
  const originalWindow = (globalThis as any).window;

  beforeEach(() => {
    (globalThis as any).localStorage.clear();
  });

  afterEach(() => {
    if (originalWindow === undefined) {
      delete (globalThis as any).window;
    } else {
      (globalThis as any).window = originalWindow;
    }
  });

  it('detects standard web browser when electronAPI is absent', () => {
    (globalThis as any).window = { location: { protocol: 'https:', origin: 'https://chess.local' } };
    expect(isElectronDesktop()).toBe(false);
    expect(buildShareInviteLink('ABC123')).toBe('https://chess.local/lobby?join=ABC123');
  });

  it('resolves stored desktop server URL and deep-link invite when running in Electron', () => {
    (globalThis as any).window = {
      electronAPI: { isElectron: true },
      location: { protocol: 'app:', origin: 'app://online-chess' },
    };

    expect(isElectronDesktop()).toBe(true);
    expect(buildShareInviteLink('XYZ789')).toBe('online-chess://lobby?join=XYZ789');

    setStoredDesktopServerUrl('https://arena.chess.dev///');
    expect(resolveApiBaseUrl()).toBe('https://arena.chess.dev/api/v1');
    expect(resolveSocketBaseUrl()).toBe('https://arena.chess.dev');
  });

  it('validates desktop OAuth loopback callbacks strictly and rejects external origins', () => {
    const validState = 'a'.repeat(48);
    expect(
      parseDesktopAuthCallback(
        `?desktopCallback=${encodeURIComponent('http://127.0.0.1:54321/callback')}&desktopState=${validState}`
      )
    ).toEqual({
      callbackUrl: 'http://127.0.0.1:54321/callback',
      state: validState,
    });

    // Reject external domains, HTTPS non-loopback, wrong paths, weak state
    expect(
      parseDesktopAuthCallback(
        `?desktopCallback=${encodeURIComponent('https://evil.example/callback')}&desktopState=${validState}`
      )
    ).toBeNull();
    expect(
      parseDesktopAuthCallback(
        `?desktopCallback=${encodeURIComponent('http://127.0.0.1:80/callback')}&desktopState=${validState}`
      )
    ).toBeNull();
    expect(
      parseDesktopAuthCallback(
        `?desktopCallback=${encodeURIComponent('http://127.0.0.1:54321/other')}&desktopState=${validState}`
      )
    ).toBeNull();
    expect(
      parseDesktopAuthCallback(
        `?desktopCallback=${encodeURIComponent('http://127.0.0.1:54321/callback')}&desktopState=short`
      )
    ).toBeNull();
  });
});
