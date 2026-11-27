import { app, BrowserWindow, dialog, Menu, MenuItemConstructorOptions } from 'electron';
import { IPC_CHANNELS } from './types';

interface AppMenuDeps {
  getWindow: () => BrowserWindow | null;
  getServerUrl: () => string;
  onQuit: () => void;
}

export function buildApplicationMenu(deps: AppMenuDeps): Menu {
  const isMac = process.platform === 'darwin';

  const navigateTo = (route: string) => {
    const win = deps.getWindow();
    if (!win) return;
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
    win.webContents.send(IPC_CHANNELS.NAVIGATE, route);
  };

  const openSettings = () => {
    const win = deps.getWindow();
    if (!win) return;
    win.show();
    win.focus();
    win.webContents.send(IPC_CHANNELS.OPEN_SETTINGS);
  };

  const toggleTheme = () => {
    const win = deps.getWindow();
    if (!win) return;
    win.webContents.send(IPC_CHANNELS.TOGGLE_THEME);
  };

  const showAbout = () => {
    const win = deps.getWindow();
    const detail = [
      `Phiên bản ứng dụng: v${app.getVersion()}`,
      `Máy chủ đang kết nối: ${deps.getServerUrl()}`,
      `Electron ${process.versions.electron} • Chromium ${process.versions.chrome} • Node ${process.versions.node}`,
      '',
      'Đấu trường cờ vua trực tuyến thời gian thực & AI Minimax Alpha-Beta.',
    ].join('\n');

    void dialog.showMessageBox(win ?? undefined!, {
      type: 'info',
      title: 'Giới thiệu Online Chess',
      message: 'Online Chess Desktop',
      detail,
      buttons: ['Đóng'],
    });
  };

  const template: MenuItemConstructorOptions[] = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { label: 'Giới thiệu Online Chess', click: showAbout },
              { type: 'separator' as const },
              { label: 'Cài đặt máy chủ...', accelerator: 'CmdOrCtrl+,', click: openSettings },
              { type: 'separator' as const },
              { role: 'hide' as const },
              { role: 'hideOthers' as const },
              { role: 'unhide' as const },
              { type: 'separator' as const },
              { label: 'Thoát Online Chess', accelerator: 'CmdOrCtrl+Q', click: deps.onQuit },
            ],
          },
        ]
      : []),
    {
      label: 'Đấu trường',
      submenu: [
        { label: 'Trang chủ', accelerator: 'CmdOrCtrl+1', click: () => navigateTo('/') },
        { label: 'Sảnh thi đấu', accelerator: 'CmdOrCtrl+2', click: () => navigateTo('/lobby') },
        { label: 'Đấu với Máy (AI)', accelerator: 'CmdOrCtrl+3', click: () => navigateTo('/ai') },
        { label: 'Bảng xếp hạng', accelerator: 'CmdOrCtrl+4', click: () => navigateTo('/leaderboard') },
        { label: 'Lịch sử đấu', accelerator: 'CmdOrCtrl+5', click: () => navigateTo('/history') },
        { type: 'separator' },
        { label: 'Cài đặt ứng dụng & máy chủ...', accelerator: 'CmdOrCtrl+,', click: openSettings },
        ...(!isMac
          ? [
              { type: 'separator' as const },
              { label: 'Thoát', accelerator: 'CmdOrCtrl+Q', click: deps.onQuit },
            ]
          : []),
      ],
    },
    {
      label: 'Chỉnh sửa',
      submenu: [
        { role: 'undo', label: 'Hoàn tác' },
        { role: 'redo', label: 'Làm lại' },
        { type: 'separator' },
        { role: 'cut', label: 'Cắt' },
        { role: 'copy', label: 'Sao chép' },
        { role: 'paste', label: 'Dán' },
        { role: 'selectAll', label: 'Chọn tất cả' },
      ],
    },
    {
      label: 'Hiển thị',
      submenu: [
        { role: 'reload', label: 'Tải lại' },
        { role: 'forceReload', label: 'Tải lại toàn bộ' },
        { type: 'separator' },
        {
          label: 'Chuyển giao diện Sáng / Tối',
          accelerator: 'CmdOrCtrl+Shift+D',
          click: toggleTheme,
        },
        { role: 'togglefullscreen', label: 'Chế độ toàn màn hình' },
        { type: 'separator' },
        { role: 'resetZoom', label: 'Kích thước mặc định' },
        { role: 'zoomIn', label: 'Phóng to' },
        { role: 'zoomOut', label: 'Thu nhỏ' },
        { type: 'separator' },
        { role: 'toggleDevTools', label: 'Công cụ nhà phát triển', accelerator: 'CmdOrCtrl+Shift+I' },
      ],
    },
    {
      label: 'Trợ giúp',
      submenu: [{ label: 'Giới thiệu Online Chess', click: showAbout }],
    },
  ];

  return Menu.buildFromTemplate(template);
}
