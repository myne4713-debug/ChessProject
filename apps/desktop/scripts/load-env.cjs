const fs = require('fs');
const path = require('path');

const DEFAULT_FALLBACK_URL = 'http://localhost:4000';

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const result = {};
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eqIndex = line.indexOf('=');
    if (eqIndex <= 0) continue;

    const key = line.slice(0, eqIndex).trim();
    let value = line.slice(eqIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }

  return result;
}

function normalizeUrl(rawUrl) {
  const trimmed = String(rawUrl || '').trim();
  if (!trimmed) return null;
  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error(`Invalid DESKTOP_SERVER_URL in .env: "${trimmed}"`);
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`DESKTOP_SERVER_URL must use http:// or https:// (got "${trimmed}")`);
  }
  const pathname = parsed.pathname.replace(/\/+$/, '');
  return `${parsed.origin}${pathname}`;
}

function resolveDesktopBuildEnv() {
  const desktopDir = path.resolve(__dirname, '..');
  const rootDir = path.resolve(desktopDir, '../..');

  // Lowest to highest priority: root .env < apps/desktop/.env < apps/desktop/.env.production < process.env
  const rootEnv = parseEnvFile(path.join(rootDir, '.env'));
  const desktopEnv = parseEnvFile(path.join(desktopDir, '.env'));
  const desktopProdEnv = parseEnvFile(path.join(desktopDir, '.env.production'));

  const pick = (...candidates) => {
    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.trim().length > 0) {
        return candidate.trim();
      }
    }
    return '';
  };

  const rawServerUrl = pick(
    process.env.DESKTOP_SERVER_URL,
    process.env.ONLINE_CHESS_SERVER_URL,
    desktopProdEnv.DESKTOP_SERVER_URL,
    desktopProdEnv.ONLINE_CHESS_SERVER_URL,
    desktopEnv.DESKTOP_SERVER_URL,
    desktopEnv.ONLINE_CHESS_SERVER_URL,
    rootEnv.DESKTOP_SERVER_URL,
    rootEnv.ONLINE_CHESS_SERVER_URL,
    rootEnv.VITE_SOCKET_URL,
    DEFAULT_FALLBACK_URL
  );

  const serverUrl = normalizeUrl(rawServerUrl) || DEFAULT_FALLBACK_URL;

  const rawApiUrl = pick(
    process.env.DESKTOP_API_URL,
    desktopProdEnv.DESKTOP_API_URL,
    desktopEnv.DESKTOP_API_URL,
    `${serverUrl}/api/v1`
  );
  const apiUrl = normalizeUrl(rawApiUrl) || `${serverUrl}/api/v1`;

  const googleClientId = pick(
    process.env.VITE_GOOGLE_CLIENT_ID,
    desktopProdEnv.VITE_GOOGLE_CLIENT_ID,
    desktopEnv.VITE_GOOGLE_CLIENT_ID,
    rootEnv.VITE_GOOGLE_CLIENT_ID
  );

  return {
    serverUrl,
    apiUrl,
    googleClientId,
  };
}

module.exports = {
  parseEnvFile,
  normalizeUrl,
  resolveDesktopBuildEnv,
};
