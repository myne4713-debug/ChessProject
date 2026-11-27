import fs from 'fs';
import path from 'path';

export interface DesktopBuildConfig {
  defaultServerUrl: string;
  defaultApiUrl?: string;
  builtAt?: string;
}

export const FALLBACK_SERVER_URL = 'http://localhost:4000';

export function loadBakedBuildConfig(
  configPath: string = path.join(__dirname, 'build-config.json')
): DesktopBuildConfig {
  try {
    if (!fs.existsSync(configPath)) {
      return { defaultServerUrl: FALLBACK_SERVER_URL };
    }
    const raw = fs.readFileSync(configPath, 'utf8');
    const parsed = JSON.parse(raw) as Partial<DesktopBuildConfig>;
    if (typeof parsed.defaultServerUrl === 'string' && parsed.defaultServerUrl.trim()) {
      return {
        defaultServerUrl: parsed.defaultServerUrl.trim().replace(/\/+$/, ''),
        defaultApiUrl: parsed.defaultApiUrl,
        builtAt: parsed.builtAt,
      };
    }
  } catch {
    // Non-fatal: fall back to localhost default
  }
  return { defaultServerUrl: FALLBACK_SERVER_URL };
}
