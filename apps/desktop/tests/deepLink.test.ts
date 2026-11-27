import { describe, expect, it } from 'vitest';
import { extractDeepLinkFromArgv, parseDeepLinkToRoute } from '../src/deepLink';

describe('Desktop Deep Link Parser', () => {
  it('parses room invite deep links with query parameters', () => {
    expect(parseDeepLinkToRoute('online-chess://lobby?join=AB12CD')).toBe('/lobby?join=AB12CD');
    expect(parseDeepLinkToRoute('online-chess://game/match-42')).toBe('/game/match-42');
    expect(parseDeepLinkToRoute('online-chess://ai')).toBe('/ai');
    expect(parseDeepLinkToRoute('online-chess://leaderboard')).toBe('/leaderboard');
    expect(parseDeepLinkToRoute('online-chess://history')).toBe('/history');
  });

  it('rejects unknown schemes, unknown routes, and path traversal attempts', () => {
    expect(parseDeepLinkToRoute('https://evil.example/lobby')).toBeNull();
    expect(parseDeepLinkToRoute('javascript:alert(1)')).toBeNull();
    expect(parseDeepLinkToRoute('online-chess://unknown-route')).toBeNull();
    expect(parseDeepLinkToRoute('online-chess://lobby/../admin')).toBeNull();
    expect(parseDeepLinkToRoute('online-chess://game/%2e%2e/secret')).toBeNull();
  });

  it('extracts deep links from Windows/Linux argv arrays', () => {
    const route = extractDeepLinkFromArgv([
      'OnlineChess.exe',
      '--allow-file-access-from-files',
      'online-chess://lobby?join=CHESS9',
    ]);
    expect(route).toBe('/lobby?join=CHESS9');
    expect(extractDeepLinkFromArgv(['OnlineChess.exe'])).toBeNull();
  });
});
