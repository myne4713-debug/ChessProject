import fs from 'fs';
import path from 'path';

export const APP_SCHEME = 'app';
export const APP_HOST = 'online-chess';
export const APP_ORIGIN = `${APP_SCHEME}://${APP_HOST}`;

/**
 * Resolves an `app://online-chess/...` URL strictly inside `rendererRoot`.
 * Static assets are returned if they exist; SPA routes fall back to `index.html`.
 * Returns `null` if path traversal is attempted or a missing static file asset is requested.
 */
export function resolveRendererFile(rendererRoot: string, requestUrl: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(requestUrl);
  } catch {
    return null;
  }

  if (parsed.protocol !== `${APP_SCHEME}:` || parsed.hostname !== APP_HOST) {
    return null;
  }

  let decodedPathname: string;
  try {
    decodedPathname = decodeURIComponent(parsed.pathname);
  } catch {
    return null;
  }

  if (decodedPathname.includes('\0') || decodedPathname.split(/[\\/]/).includes('..')) {
    return null;
  }

  const resolvedRoot = path.resolve(rendererRoot);
  const relativePath = decodedPathname.replace(/^\/+/, '');
  const candidate = path.resolve(resolvedRoot, relativePath || 'index.html');

  const rel = path.relative(resolvedRoot, candidate);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    return null;
  }

  if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
    return candidate;
  }

  // Missing explicit static assets should 404 rather than serve HTML
  if (path.extname(relativePath)) {
    return null;
  }

  const fallbackIndex = path.join(resolvedRoot, 'index.html');
  return fs.existsSync(fallbackIndex) ? fallbackIndex : null;
}
