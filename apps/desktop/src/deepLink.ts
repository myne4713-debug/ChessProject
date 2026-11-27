export const DEEP_LINK_SCHEME = 'online-chess';

const ALLOWED_ROUTE_PREFIXES = new Set([
  '',
  'lobby',
  'ai',
  'game',
  'leaderboard',
  'history',
  'profile',
  'login',
  'register',
  'verify-email',
  'admin',
]);

/**
 * Parses an `online-chess://` deep-link URL into a safe in-app route.
 * Examples:
 *  - `online-chess://lobby?join=ABC123` -> `/lobby?join=ABC123`
 *  - `online-chess://game/12345` -> `/game/12345`
 *  - `online-chess://ai` -> `/ai`
 */
export function parseDeepLinkToRoute(rawUrl: string): string | null {
  if (!rawUrl || typeof rawUrl !== 'string') return null;

  const trimmed = rawUrl.trim();
  // Reject traversal sequences before WHATWG URL normalization collapses `/../`
  let rawDecoded = trimmed;
  try {
    rawDecoded = decodeURIComponent(trimmed);
  } catch {
    return null;
  }
  if (rawDecoded.includes('\0') || /(?:^|[\\/])\.\.(?:$|[\\/?#])/.test(rawDecoded)) {
    return null;
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }

  if (parsed.protocol !== `${DEEP_LINK_SCHEME}:`) {
    return null;
  }

  // Combine host and pathname because `online-chess://lobby?join=XYZ` puts `lobby` in hostname
  const hostSegment = parsed.hostname.replace(/^\/+|\/+$/g, '');
  const pathSegments = parsed.pathname
    .split('/')
    .map((s) => s.trim())
    .filter(Boolean);

  const segments = hostSegment ? [hostSegment, ...pathSegments] : pathSegments;

  // Guard against traversal or empty/illegal characters
  for (const segment of segments) {
    if (segment === '.' || segment === '..' || !/^[a-zA-Z0-9._-]+$/.test(segment)) {
      return null;
    }
  }

  const rootSegment = segments[0] ?? '';
  if (!ALLOWED_ROUTE_PREFIXES.has(rootSegment)) {
    return null;
  }

  const routePath = segments.length > 0 ? `/${segments.join('/')}` : '/';
  return `${routePath}${parsed.search}`;
}

export function extractDeepLinkFromArgv(argv: string[]): string | null {
  const prefix = `${DEEP_LINK_SCHEME}://`;
  for (const arg of argv) {
    if (typeof arg === 'string' && arg.startsWith(prefix)) {
      const route = parseDeepLinkToRoute(arg);
      if (route) return route;
    }
  }
  return null;
}
