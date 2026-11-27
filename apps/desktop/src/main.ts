import fs from 'fs';
import path from 'path';
import {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  nativeTheme,
  Notification,
  protocol,
  screen,
  shell,
} from 'electron';
import { DEEP_LINK_SCHEME, extractDeepLinkFromArgv, parseDeepLinkToRoute } from './deepLink';
import { checkServerHealth } from './healthCheck';
import { buildApplicationMenu } from './menu';
import { APP_ORIGIN, APP_SCHEME, registerAppProtocol } from './protocol';
import { DesktopSettingsStore } from './settingsStore';
import { DesktopTrayManager } from './tray';
import {
  DesktopAppInfo,
  DesktopNotificationPayload,
  DesktopSettings,
  IPC_CHANNELS,
  WindowState,
  WindowUIState,
} from './types';
import {
  DisplayWorkArea,
  loadWindowState,
  MIN_WINDOW_HEIGHT,
  MIN_WINDOW_WIDTH,
  saveWindowState,
} from './windowState';

const APP_USER_MODEL_ID = 'com.onlinechess.desktop';

// Privileged custom scheme MUST be registered synchronously before `app.whenReady()`
protocol.registerSchemesAsPrivileged([
  {
    scheme: APP_SCHEME,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    },
  },
]);

const devRendererUrl = process.env.ELECTRON_RENDERER_URL?.trim() || '';
const isDev = Boolean(devRendererUrl);

let mainWindow: BrowserWindow | null = null;
let settingsStore: DesktopSettingsStore | null = null;
let trayManager: DesktopTrayManager | null = null;
let isQuitting = false;
let pendingDeepLinkRoute: string | null = extractDeepLinkFromArgv(process.argv);

function getAssetsDir(): string {
  return path.resolve(__dirname, '../assets');
}

function getRendererDir(): string {
  const bundledRenderer = path.resolve(__dirname, '../renderer');
  if (fs.existsSync(path.join(bundledRenderer, 'index.html'))) {
    return bundledRenderer;
  }
  return path.resolve(__dirname, '../../web/dist');
}

function getWindowIconPath(): string | undefined {
  const assetsDir = getAssetsDir();
  const preferred =
    process.platform === 'win32'
      ? path.join(assetsDir, 'icon.ico')
      : path.join(assetsDir, 'icon.png');
  if (fs.existsSync(preferred)) return preferred;

  const fallback = path.join(assetsDir, 'icon.png');
  return fs.existsSync(fallback) ? fallback : undefined;
}

function getWindowUIState(win: BrowserWindow): WindowUIState {
  return {
    isMaximized: win.isMaximized(),
    isFullScreen: win.isFullScreen(),
    isFocused: win.isFocused(),
  };
}

function emitWindowState(win: BrowserWindow): void {
  if (!win.isDestroyed()) {
    win.webContents.send(IPC_CHANNELS.WINDOW_STATE_CHANGED, getWindowUIState(win));
  }
}

function showAndFocusMainWindow(): void {
  if (!mainWindow) {
    createMainWindow();
    return;
  }
  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }
  if (!mainWindow.isVisible()) {
    mainWindow.show();
  }
  mainWindow.focus();
}

function deliverDeepLink(route: string): void {
  if (!mainWindow || mainWindow.isDestroyed()) {
    pendingDeepLinkRoute = route;
    return;
  }
  showAndFocusMainWindow();
  if (mainWindow.webContents.isLoadingMainFrame()) {
    pendingDeepLinkRoute = route;
  } else {
    mainWindow.webContents.send(IPC_CHANNELS.NAVIGATE, route);
  }
}

function isAllowedInAppOrigin(targetUrl: string): boolean {
  try {
    const parsed = new URL(targetUrl);
    if (isDev && devRendererUrl) {
      return parsed.origin === new URL(devRendererUrl).origin;
    }
    return parsed.origin === APP_ORIGIN;
  } catch {
    return false;
  }
}

function isAllowedAuthPopup(targetUrl: string): boolean {
  try {
    const parsed = new URL(targetUrl);
    return (
      parsed.protocol === 'https:' &&
      (parsed.hostname === 'accounts.google.com' ||
        parsed.hostname.endsWith('.accounts.google.com'))
    );
  } catch {
    return false;
  }
}

function isSafeExternalUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' || parsed.protocol === 'mailto:';
  } catch {
    return false;
  }
}

function resolveInitialBackgroundColor(settings: DesktopSettings): string {
  const useDark =
    settings.theme === 'dark' || (settings.theme === 'system' && nativeTheme.shouldUseDarkColors);
  return useDark ? '#0b1120' : '#f8fafc';
}

function createMainWindow(): BrowserWindow {
  const store = settingsStore!;
  const settings = store.get();
  const windowStatePath = path.join(app.getPath('userData'), 'window-state.json');
  const displays: DisplayWorkArea[] = screen.getAllDisplays().map((d) => d.workArea);
  const savedState = loadWindowState(windowStatePath, displays);

  const win = new BrowserWindow({
    x: savedState.x,
    y: savedState.y,
    width: savedState.width,
    height: savedState.height,
    minWidth: MIN_WINDOW_WIDTH,
    minHeight: MIN_WINDOW_HEIGHT,
    show: false,
    title: 'Online Chess — Đấu trường cờ vua',
    icon: getWindowIconPath(),
    backgroundColor: resolveInitialBackgroundColor(settings),
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'hidden',
    trafficLightPosition: process.platform === 'darwin' ? { x: 14, y: 12 } : undefined,
    autoHideMenuBar: process.platform !== 'darwin',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
      devTools: true,
    },
  });

  mainWindow = win;

  let saveTimer: NodeJS.Timeout | null = null;
  const scheduleSaveWindowState = () => {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      if (win.isDestroyed()) return;
      const normalBounds = win.getNormalBounds();
      const nextState: WindowState = {
        x: normalBounds.x,
        y: normalBounds.y,
        width: normalBounds.width,
        height: normalBounds.height,
        isMaximized: win.isMaximized(),
      };
      saveWindowState(windowStatePath, nextState);
    }, 250);
  };

  win.on('resize', scheduleSaveWindowState);
  win.on('move', scheduleSaveWindowState);
  win.on('maximize', () => {
    scheduleSaveWindowState();
    emitWindowState(win);
  });
  win.on('unmaximize', () => {
    scheduleSaveWindowState();
    emitWindowState(win);
  });
  win.on('enter-full-screen', () => emitWindowState(win));
  win.on('leave-full-screen', () => emitWindowState(win));
  win.on('focus', () => {
    win.flashFrame(false);
    emitWindowState(win);
  });
  win.on('blur', () => emitWindowState(win));

  win.on('close', (event) => {
    const currentSettings = store.get();
    if (!isQuitting && currentSettings.minimizeToTray && trayManager) {
      event.preventDefault();
      win.hide();
      return;
    }
    const normalBounds = win.getNormalBounds();
    saveWindowState(windowStatePath, {
      x: normalBounds.x,
      y: normalBounds.y,
      width: normalBounds.width,
      height: normalBounds.height,
      isMaximized: win.isMaximized(),
    });
  });

  win.on('closed', () => {
    if (saveTimer) clearTimeout(saveTimer);
    if (mainWindow === win) {
      mainWindow = null;
    }
  });

  win.once('ready-to-show', () => {
    if (savedState.isMaximized) {
      win.maximize();
    }
    win.show();
    emitWindowState(win);
  });

  win.webContents.on('did-finish-load', () => {
    emitWindowState(win);
    if (pendingDeepLinkRoute) {
      const route = pendingDeepLinkRoute;
      pendingDeepLinkRoute = null;
      win.webContents.send(IPC_CHANNELS.NAVIGATE, route);
    }
  });

  // Strict navigation & external popup security policy
  win.webContents.on('will-navigate', (event, targetUrl) => {
    if (isAllowedInAppOrigin(targetUrl)) {
      return;
    }
    event.preventDefault();
    if (isSafeExternalUrl(targetUrl)) {
      void shell.openExternal(targetUrl);
    }
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isAllowedAuthPopup(url)) {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          width: 520,
          height: 660,
          autoHideMenuBar: true,
          webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
          },
        },
      };
    }

    if (isSafeExternalUrl(url)) {
      void shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  const entryUrl = isDev ? devRendererUrl : `${APP_ORIGIN}/`;
  void win.loadURL(entryUrl);

  return win;
}

function registerIpcHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.APP_GET_INFO, (): DesktopAppInfo => ({
    appName: 'Online Chess Desktop',
    appVersion: app.getVersion(),
    electronVersion: process.versions.electron,
    chromeVersion: process.versions.chrome,
    nodeVersion: process.versions.node,
    platform: process.platform,
    isDev,
    defaultServerUrl: settingsStore!.getDefaultServerUrl(),
  }));

  ipcMain.handle(IPC_CHANNELS.SETTINGS_GET, (): DesktopSettings => settingsStore!.get());

  ipcMain.handle(
    IPC_CHANNELS.SETTINGS_UPDATE,
    (_event, patch: Partial<DesktopSettings>): DesktopSettings => {
      const updated = settingsStore!.update(patch ?? {});
      trayManager?.refreshMenu();
      mainWindow?.webContents.send(IPC_CHANNELS.SETTINGS_CHANGED, updated);
      return updated;
    }
  );

  ipcMain.handle(IPC_CHANNELS.SERVER_HEALTH_CHECK, async (_event, customUrl?: string) => {
    const targetUrl =
      typeof customUrl === 'string' && customUrl.trim().length > 0
        ? customUrl
        : settingsStore!.get().serverUrl;
    return checkServerHealth(targetUrl);
  });

  ipcMain.handle(IPC_CHANNELS.WINDOW_MINIMIZE, () => {
    mainWindow?.minimize();
  });

  ipcMain.handle(IPC_CHANNELS.WINDOW_TOGGLE_MAXIMIZE, (): WindowUIState => {
    if (!mainWindow) {
      return { isMaximized: false, isFullScreen: false, isFocused: false };
    }
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
    return getWindowUIState(mainWindow);
  });

  ipcMain.handle(IPC_CHANNELS.WINDOW_CLOSE, () => {
    mainWindow?.close();
  });

  ipcMain.handle(IPC_CHANNELS.WINDOW_GET_STATE, (): WindowUIState => {
    if (!mainWindow) {
      return { isMaximized: false, isFullScreen: false, isFocused: false };
    }
    return getWindowUIState(mainWindow);
  });

  ipcMain.handle(IPC_CHANNELS.WINDOW_TOGGLE_FULLSCREEN, (): WindowUIState => {
    if (!mainWindow) {
      return { isMaximized: false, isFullScreen: false, isFocused: false };
    }
    mainWindow.setFullScreen(!mainWindow.isFullScreen());
    return getWindowUIState(mainWindow);
  });

  ipcMain.handle(
    IPC_CHANNELS.NOTIFY,
    (_event, payload: DesktopNotificationPayload): boolean => {
      const settings = settingsStore!.get();
      if (!settings.notificationsEnabled || !Notification.isSupported()) {
        return false;
      }

      const title = String(payload?.title || '').trim().slice(0, 120);
      const body = String(payload?.body || '').trim().slice(0, 300);
      if (!title || !body) return false;

      // Avoid intrusive notifications while the user is already focused on the window unless forced
      if (mainWindow && mainWindow.isFocused() && !payload?.force) {
        return false;
      }

      const notification = new Notification({
        title,
        body,
        icon: getWindowIconPath(),
      });

      notification.on('click', () => {
        showAndFocusMainWindow();
        if (payload?.route && payload.route.startsWith('/')) {
          mainWindow?.webContents.send(IPC_CHANNELS.NAVIGATE, payload.route);
        }
      });

      notification.show();

      if (settings.flashTaskbar && mainWindow && !mainWindow.isFocused()) {
        mainWindow.flashFrame(true);
      }

      return true;
    }
  );

  ipcMain.on(IPC_CHANNELS.REQUEST_ATTENTION, () => {
    const settings = settingsStore!.get();
    if (settings.flashTaskbar && mainWindow && !mainWindow.isFocused()) {
      mainWindow.flashFrame(true);
    }
  });

  ipcMain.handle(IPC_CHANNELS.OPEN_EXTERNAL, async (_event, url: string): Promise<boolean> => {
    if (typeof url !== 'string' || !isSafeExternalUrl(url)) {
      return false;
    }
    await shell.openExternal(url);
    return true;
  });
}

function registerDeepLinkProtocol(): void {
  if (process.defaultApp) {
    if (process.argv.length >= 2) {
      app.setAsDefaultProtocolClient(DEEP_LINK_SCHEME, process.execPath, [
        path.resolve(process.argv[1]),
      ]);
    }
  } else {
    app.setAsDefaultProtocolClient(DEEP_LINK_SCHEME);
  }
}

const gotSingleInstanceLock = app.requestSingleInstanceLock();

if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, commandLine) => {
    const route = extractDeepLinkFromArgv(commandLine);
    if (route) {
      deliverDeepLink(route);
    } else {
      showAndFocusMainWindow();
    }
  });

  app.on('open-url', (event, rawUrl) => {
    event.preventDefault();
    const route = parseDeepLinkToRoute(rawUrl);
    if (route) {
      deliverDeepLink(route);
    }
  });

  app.on('before-quit', () => {
    isQuitting = true;
    trayManager?.destroy();
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    } else {
      showAndFocusMainWindow();
    }
  });

  app.whenReady().then(() => {
    if (process.platform === 'win32') {
      app.setAppUserModelId(APP_USER_MODEL_ID);
    }

    settingsStore = new DesktopSettingsStore(
      path.join(app.getPath('userData'), 'desktop-settings.json')
    );

    if (!isDev) {
      registerAppProtocol(getRendererDir());
    }

    registerDeepLinkProtocol();
    registerIpcHandlers();

    const quitApp = () => {
      isQuitting = true;
      app.quit();
    };

    const appMenu = buildApplicationMenu({
      getWindow: () => mainWindow,
      getServerUrl: () => settingsStore!.get().serverUrl,
      onQuit: quitApp,
    });
    Menu.setApplicationMenu(appMenu);

    const trayIconPath = path.join(getAssetsDir(), 'tray-icon.png');
    trayManager = new DesktopTrayManager({
      iconPath: trayIconPath,
      settingsStore,
      getWindow: () => mainWindow,
      onShowWindow: showAndFocusMainWindow,
      onQuit: quitApp,
    });
    trayManager.init();

    createMainWindow();
  });
}
