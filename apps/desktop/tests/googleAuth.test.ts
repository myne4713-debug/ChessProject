import { afterEach, describe, expect, it } from 'vitest';
import { DesktopGoogleAuthBroker } from '../src/googleAuth';

let activeBroker: DesktopGoogleAuthBroker | null = null;

afterEach(() => {
  activeBroker?.cancel('cleanup');
  activeBroker = null;
});

describe('Desktop Google Auth Loopback Broker', () => {
  it('completes OAuth flow when valid state and access token are returned on loopback callback', async () => {
    const broker = new DesktopGoogleAuthBroker();
    activeBroker = broker;
    let focused = false;

    const resultPromise = broker.start({
      serverUrl: 'https://mynechess.duckdns.org/',
      onSuccessFocus: () => {
        focused = true;
      },
      openBrowser: async (loginUrl) => {
        const parsedLogin = new URL(loginUrl);
        expect(parsedLogin.origin).toBe('https://mynechess.duckdns.org');
        expect(parsedLogin.pathname).toBe('/login');

        const callbackUrl = parsedLogin.searchParams.get('desktopCallback');
        const state = parsedLogin.searchParams.get('desktopState');
        expect(callbackUrl).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/callback$/);
        expect(state).toMatch(/^[a-f0-9]{48}$/);

        // Wrong state must be rejected with 400 without settling the broker
        const badStateRes = await fetch(`${callbackUrl}?state=wrongstate&googleAccessToken=bad`);
        expect(badStateRes.status).toBe(400);

        // Correct state must return 200 and resolve token
        const okRes = await fetch(
          `${callbackUrl}?state=${encodeURIComponent(state!)}&googleAccessToken=ya29.mock_token_123`
        );
        expect(okRes.status).toBe(200);
      },
    });

    const result = await resultPromise;
    expect(result).toEqual({ accessToken: 'ya29.mock_token_123' });
    expect(focused).toBe(true);
  });

  it('rejects cleanly when cancelled by user', async () => {
    const broker = new DesktopGoogleAuthBroker();
    activeBroker = broker;

    const promise = broker.start({
      serverUrl: 'https://mynechess.duckdns.org',
      openBrowser: () => {
        setTimeout(() => broker.cancel('Người dùng đã hủy'), 20);
      },
    });

    await expect(promise).rejects.toThrow('Người dùng đã hủy');
  });
});
