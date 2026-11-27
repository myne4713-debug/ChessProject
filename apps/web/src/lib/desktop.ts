export type DesktopThemeMode = 'light' | 'dark' | 'system';

export interface DesktopSettings {
  serverUrl: string;
  minimizeToTray: boolean;
  notificationsEnabled: boolean;
  flashTaskbar: boolean;
  theme: DesktopThemeMode;
}

export interface ServerHealthResult {
  ok: boolean;
  serverUrl: string;
  statusCode?: number;
  latencyMs: number;
  database?: string;
  uptime?: number;
  error?: string;
}

export interface DesktopNotificationPayload {
  title: string;
  body: string;
  route?: string;
  force?: boolean;
}

export interface DesktopAppInfo {
  appName: string;
  appVersion: string;
  electronVersion: string;
  chromeVersion: string;
  nodeVersion: string;
  platform: string;
  isDev: boolean;
  defaultServerUrl?: string;
}

export interface WindowUIState {
  isMaximized: boolean;
  isFullScreen: boolean;
  isFocused: boolean;
}

export interface ElectronDesktopAPI {
  isElectron: true;
  platform: string;
  getAppInfo: () => Promise<DesktopAppInfo>;
  getSettings: () => Promise<DesktopSettings>;
  updateSettings: (patch: Partial<DesktopSettings>) => Promise<DesktopSettings>;
  checkServerHealth: (serverUrl?: string) => Promise<ServerHealthResult>;
  windowControls: {
    minimize: () => Promise<void>;
    toggleMaximize: () => Promise<WindowUIState>;
    close: () => Promise<void>;
    getState: () => Promise<WindowUIState>;
    toggleFullscreen: () => Promise<WindowUIState>;
  };
  notify: (payload: DesktopNotificationPayload) => Promise<boolean>;
  requestAttention: () => void;
  openExternal: (url: string) => Promise<boolean>;
  onWindowStateChange: (listener: (state: WindowUIState) => void) => () => void;
  onNavigate: (listener: (route: string) => void) => () => void;
  onOpenSettings: (listener: () => void) => () => void;
  onThemeToggle: (listener: () => void) => () => void;
  onSettingsChanged: (listener: (settings: DesktopSettings) => void) => () => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronDesktopAPI;
  }
}

const STORAGE_SERVER_URL_KEY = 'online_chess_desktop_server_url';
const DEFAULT_DESKTOP_SERVER = 'http://localhost:4000';

export function isElectronDesktop(): boolean {
  return typeof window !== 'undefined' && Boolean(window.electronAPI?.isElectron);
}

export function getDesktopApi(): ElectronDesktopAPI | null {
  return isElectronDesktop() ? window.electronAPI! : null;
}

function stripTrailingSlashes(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

export function getStoredDesktopServerUrl(): string | null {
  if (typeof localStorage === 'undefined') return null;
  const saved = localStorage.getItem(STORAGE_SERVER_URL_KEY);
  return saved ? stripTrailingSlashes(saved) : null;
}

export function setStoredDesktopServerUrl(serverUrl: string): string {
  const clean = stripTrailingSlashes(serverUrl);
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(STORAGE_SERVER_URL_KEY, clean);
  }
  return clean;
}

export function resolveApiBaseUrl(): string {
  if (isElectronDesktop()) {
    const stored = getStoredDesktopServerUrl();
    if (stored) return `${stored}/api/v1`;

    const envApi = import.meta.env.VITE_API_URL;
    if (envApi && /^https?:\/\//i.test(envApi)) {
      return stripTrailingSlashes(envApi);
    }
    return `${DEFAULT_DESKTOP_SERVER}/api/v1`;
  }

  return import.meta.env.VITE_API_URL || '/api/v1';
}

export function resolveSocketBaseUrl(): string {
  if (isElectronDesktop()) {
    const stored = getStoredDesktopServerUrl();
    if (stored) return stored;

    const envSocket = import.meta.env.VITE_SOCKET_URL;
    if (envSocket && /^https?:\/\//i.test(envSocket)) {
      return stripTrailingSlashes(envSocket);
    }
    return DEFAULT_DESKTOP_SERVER;
  }

  return import.meta.env.VITE_SOCKET_URL || '/';
}

export function buildShareInviteLink(roomCode: string): string {
  if (typeof window === 'undefined') {
    return `online-chess://lobby?join=${roomCode}`;
  }
  if (window.location.protocol === 'http:' || window.location.protocol === 'https:') {
    return `${window.location.origin}/lobby?join=${roomCode}`;
  }
  return `online-chess://lobby?join=${roomCode}`;
}

export function notifyDesktop(payload: DesktopNotificationPayload): void {
  const api = getDesktopApi();
  if (!api) return;
  void api.notify(payload);
}

export function applyDesktopTheme(theme: DesktopThemeMode): void {
  if (typeof document === 'undefined') return;
  const prefersDark =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  const resolved = theme === 'system' ? (prefersDark ? 'dark' : 'light') : theme;
  if (resolved === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.classList.remove('dark');
  }
}
