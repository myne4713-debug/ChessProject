import fs from 'fs';
import path from 'path';
import { FALLBACK_SERVER_URL, loadBakedBuildConfig } from './buildConfig';
import { DesktopSettings, DesktopThemeMode } from './types';

export const DEFAULT_SERVER_URL = FALLBACK_SERVER_URL;

const VALID_THEMES = new Set<DesktopThemeMode>(['light', 'dark', 'system']);

export function normalizeServerUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    throw new Error('Địa chỉ máy chủ không được để trống.');
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error('Địa chỉ máy chủ không hợp lệ (ví dụ: http://localhost:4000).');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Chỉ hỗ trợ giao thức http:// hoặc https://.');
  }

  if (!parsed.hostname) {
    throw new Error('Thiếu tên miền hoặc địa chỉ IP của máy chủ.');
  }

  // Strip trailing slashes and ignore query/hash fragments for clean base URL
  const pathname = parsed.pathname.replace(/\/+$/, '');
  return `${parsed.origin}${pathname}`;
}

export function getDefaultSettings(
  env: NodeJS.ProcessEnv = process.env,
  bakedDefaultUrl?: string
): DesktopSettings {
  const fallbackBase = bakedDefaultUrl || loadBakedBuildConfig().defaultServerUrl || DEFAULT_SERVER_URL;
  const envCandidate =
    env.DESKTOP_SERVER_URL || env.ONLINE_CHESS_SERVER_URL || env.VITE_SOCKET_URL || fallbackBase;
  let serverUrl = DEFAULT_SERVER_URL;
  try {
    serverUrl = normalizeServerUrl(envCandidate);
  } catch {
    serverUrl = DEFAULT_SERVER_URL;
  }

  return {
    serverUrl,
    minimizeToTray: false,
    notificationsEnabled: true,
    flashTaskbar: true,
    theme: 'light',
  };
}

export function sanitizeSettingsPatch(
  current: DesktopSettings,
  patch: Partial<DesktopSettings>
): DesktopSettings {
  const next: DesktopSettings = { ...current };

  if (typeof patch.serverUrl === 'string') {
    next.serverUrl = normalizeServerUrl(patch.serverUrl);
  }
  if (typeof patch.minimizeToTray === 'boolean') {
    next.minimizeToTray = patch.minimizeToTray;
  }
  if (typeof patch.notificationsEnabled === 'boolean') {
    next.notificationsEnabled = patch.notificationsEnabled;
  }
  if (typeof patch.flashTaskbar === 'boolean') {
    next.flashTaskbar = patch.flashTaskbar;
  }
  if (typeof patch.theme === 'string' && VALID_THEMES.has(patch.theme as DesktopThemeMode)) {
    next.theme = patch.theme as DesktopThemeMode;
  }

  return next;
}

export class DesktopSettingsStore {
  private readonly filePath: string;
  private readonly defaultServerUrl: string;
  private settings: DesktopSettings;

  constructor(
    filePath: string,
    env: NodeJS.ProcessEnv = process.env,
    bakedDefaultUrl?: string
  ) {
    this.filePath = filePath;
    const defaults = getDefaultSettings(env, bakedDefaultUrl);
    this.defaultServerUrl = defaults.serverUrl;
    this.settings = this.load(defaults);
  }

  private load(defaults: DesktopSettings): DesktopSettings {
    try {
      if (!fs.existsSync(this.filePath)) {
        return defaults;
      }
      const raw = fs.readFileSync(this.filePath, 'utf8');
      const parsed = JSON.parse(raw) as Partial<DesktopSettings>;
      return sanitizeSettingsPatch(defaults, parsed);
    } catch {
      return defaults;
    }
  }

  getDefaultServerUrl(): string {
    return this.defaultServerUrl;
  }

  get(): DesktopSettings {
    return { ...this.settings };
  }

  update(patch: Partial<DesktopSettings>): DesktopSettings {
    const next = sanitizeSettingsPatch(this.settings, patch);
    this.settings = next;
    this.persist();
    return this.get();
  }

  private persist(): void {
    const dir = path.dirname(this.filePath);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(this.filePath, JSON.stringify(this.settings, null, 2), 'utf8');
  }
}
