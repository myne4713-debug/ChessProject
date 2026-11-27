import fs from 'fs';
import { BrowserWindow, Menu, nativeImage, Tray } from 'electron';
import { DesktopSettingsStore } from './settingsStore';
import { IPC_CHANNELS } from './types';

interface TrayDeps {
  iconPath: string;
  settingsStore: DesktopSettingsStore;
  getWindow: () => BrowserWindow | null;
  onShowWindow: () => void;
  onQuit: () => void;
}

export class DesktopTrayManager {
  private tray: Tray | null = null;
  private readonly deps: TrayDeps;

  constructor(deps: TrayDeps) {
    this.deps = deps;
  }

  init(): void {
    if (this.tray || !fs.existsSync(this.deps.iconPath)) {
      return;
    }

    const icon = nativeImage.createFromPath(this.deps.iconPath);
    if (icon.isEmpty()) {
      return;
    }

    this.tray = new Tray(icon.resize({ width: 16, height: 16 }));
    this.tray.setToolTip('Online Chess — Đấu trường cờ vua');
    this.tray.on('click', () => this.deps.onShowWindow());
    this.tray.on('double-click', () => this.deps.onShowWindow());
    this.refreshMenu();
  }

  refreshMenu(): void {
    if (!this.tray) return;
    const settings = this.deps.settingsStore.get();

    const navigate = (route: string) => {
      this.deps.onShowWindow();
      this.deps.getWindow()?.webContents.send(IPC_CHANNELS.NAVIGATE, route);
    };

    const menu = Menu.buildFromTemplate([
      { label: 'Mở Online Chess', click: () => this.deps.onShowWindow() },
      { type: 'separator' },
      { label: 'Sảnh thi đấu', click: () => navigate('/lobby') },
      { label: 'Đấu với Máy (AI)', click: () => navigate('/ai') },
      { label: 'Bảng xếp hạng', click: () => navigate('/leaderboard') },
      { label: 'Lịch sử đấu', click: () => navigate('/history') },
      { type: 'separator' },
      {
        label: 'Thu nhỏ xuống khay khi đóng',
        type: 'checkbox',
        checked: settings.minimizeToTray,
        click: (menuItem) => {
          const updated = this.deps.settingsStore.update({ minimizeToTray: menuItem.checked });
          this.deps.getWindow()?.webContents.send(IPC_CHANNELS.SETTINGS_CHANGED, updated);
          this.refreshMenu();
        },
      },
      {
        label: 'Cài đặt máy chủ...',
        click: () => {
          this.deps.onShowWindow();
          this.deps.getWindow()?.webContents.send(IPC_CHANNELS.OPEN_SETTINGS);
        },
      },
      { type: 'separator' },
      { label: 'Thoát Online Chess', click: () => this.deps.onQuit() },
    ]);

    this.tray.setContextMenu(menu);
  }

  destroy(): void {
    if (this.tray) {
      this.tray.destroy();
      this.tray = null;
    }
  }
}
