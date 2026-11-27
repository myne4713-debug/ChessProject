export type DesktopThemeMode = 'light' | 'dark' | 'system';

export interface DesktopSettings {
  serverUrl: string;
  minimizeToTray: boolean;
  notificationsEnabled: boolean;
  flashTaskbar: boolean;
  theme: DesktopThemeMode;
}

export interface WindowState {
  x?: number;
  y?: number;
  width: number;
  height: number;
  isMaximized: boolean;
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
  platform: NodeJS.Platform;
  isDev: boolean;
  defaultServerUrl: string;
}

export interface WindowUIState {
  isMaximized: boolean;
  isFullScreen: boolean;
  isFocused: boolean;
}

export const IPC_CHANNELS = {
  APP_GET_INFO: 'desktop:app:get-info',
  SETTINGS_GET: 'desktop:settings:get',
  SETTINGS_UPDATE: 'desktop:settings:update',
  SETTINGS_CHANGED: 'desktop:settings:changed',
  SERVER_HEALTH_CHECK: 'desktop:server:health-check',
  WINDOW_MINIMIZE: 'desktop:window:minimize',
  WINDOW_TOGGLE_MAXIMIZE: 'desktop:window:toggle-maximize',
  WINDOW_CLOSE: 'desktop:window:close',
  WINDOW_GET_STATE: 'desktop:window:get-state',
  WINDOW_TOGGLE_FULLSCREEN: 'desktop:window:toggle-fullscreen',
  WINDOW_STATE_CHANGED: 'desktop:window:state-changed',
  NOTIFY: 'desktop:notify',
  REQUEST_ATTENTION: 'desktop:request-attention',
  OPEN_EXTERNAL: 'desktop:open-external',
  NAVIGATE: 'desktop:navigate',
  OPEN_SETTINGS: 'desktop:open-settings',
  TOGGLE_THEME: 'desktop:toggle-theme',
  AUTH_GOOGLE_START: 'desktop:auth:google-start',
  AUTH_GOOGLE_CANCEL: 'desktop:auth:google-cancel',
} as const;
