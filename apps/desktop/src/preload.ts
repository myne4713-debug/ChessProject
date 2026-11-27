import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';
import type {
  DesktopAppInfo,
  DesktopNotificationPayload,
  DesktopSettings,
  ServerHealthResult,
  WindowUIState,
} from './types';

// Inline channel names so compiled preload.js stays self-contained under `sandbox: true`
const CHANNELS = {
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
} as const;

function subscribe<T>(channel: string, listener: (payload: T) => void): () => void {
  const wrapped = (_event: IpcRendererEvent, payload: T) => listener(payload);
  ipcRenderer.on(channel, wrapped);
  return () => {
    ipcRenderer.removeListener(channel, wrapped);
  };
}

function subscribeVoid(channel: string, listener: () => void): () => void {
  const wrapped = () => listener();
  ipcRenderer.on(channel, wrapped);
  return () => {
    ipcRenderer.removeListener(channel, wrapped);
  };
}

const electronAPI = {
  isElectron: true as const,
  platform: process.platform,

  getAppInfo: (): Promise<DesktopAppInfo> => ipcRenderer.invoke(CHANNELS.APP_GET_INFO),

  getSettings: (): Promise<DesktopSettings> => ipcRenderer.invoke(CHANNELS.SETTINGS_GET),

  updateSettings: (patch: Partial<DesktopSettings>): Promise<DesktopSettings> =>
    ipcRenderer.invoke(CHANNELS.SETTINGS_UPDATE, patch),

  checkServerHealth: (serverUrl?: string): Promise<ServerHealthResult> =>
    ipcRenderer.invoke(CHANNELS.SERVER_HEALTH_CHECK, serverUrl),

  windowControls: {
    minimize: (): Promise<void> => ipcRenderer.invoke(CHANNELS.WINDOW_MINIMIZE),
    toggleMaximize: (): Promise<WindowUIState> =>
      ipcRenderer.invoke(CHANNELS.WINDOW_TOGGLE_MAXIMIZE),
    close: (): Promise<void> => ipcRenderer.invoke(CHANNELS.WINDOW_CLOSE),
    getState: (): Promise<WindowUIState> => ipcRenderer.invoke(CHANNELS.WINDOW_GET_STATE),
    toggleFullscreen: (): Promise<WindowUIState> =>
      ipcRenderer.invoke(CHANNELS.WINDOW_TOGGLE_FULLSCREEN),
  },

  notify: (payload: DesktopNotificationPayload): Promise<boolean> =>
    ipcRenderer.invoke(CHANNELS.NOTIFY, payload),

  requestAttention: (): void => {
    ipcRenderer.send(CHANNELS.REQUEST_ATTENTION);
  },

  openExternal: (url: string): Promise<boolean> =>
    ipcRenderer.invoke(CHANNELS.OPEN_EXTERNAL, url),

  onWindowStateChange: (listener: (state: WindowUIState) => void) =>
    subscribe<WindowUIState>(CHANNELS.WINDOW_STATE_CHANGED, listener),

  onNavigate: (listener: (route: string) => void) =>
    subscribe<string>(CHANNELS.NAVIGATE, listener),

  onOpenSettings: (listener: () => void) => subscribeVoid(CHANNELS.OPEN_SETTINGS, listener),

  onThemeToggle: (listener: () => void) => subscribeVoid(CHANNELS.TOGGLE_THEME, listener),

  onSettingsChanged: (listener: (settings: DesktopSettings) => void) =>
    subscribe<DesktopSettings>(CHANNELS.SETTINGS_CHANGED, listener),
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
