import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle2,
  Loader2,
  Maximize2,
  Minimize2,
  Minus,
  Moon,
  RefreshCw,
  Server,
  SlidersHorizontal,
  Sun,
  Wifi,
  WifiOff,
  X,
  AlertCircle,
} from 'lucide-react';
import { PieceSvg } from '../chess/PieceSvg';
import { useDialogFocusTrap } from '../../hooks/useDialogFocusTrap';
import {
  applyDesktopTheme,
  DesktopAppInfo,
  DesktopSettings,
  DesktopThemeMode,
  getDesktopApi,
  ServerHealthResult,
  WindowUIState,
} from '../../lib/desktop';
import { updateApiServerUrl } from '../../services/api';
import { updateSocketServerUrl } from '../../services/socket';

const DEFAULT_SETTINGS: DesktopSettings = {
  serverUrl: 'http://localhost:4000',
  minimizeToTray: false,
  notificationsEnabled: true,
  flashTaskbar: true,
  theme: 'light',
};

export function DesktopShellBar() {
  const desktopApi = getDesktopApi();
  const navigate = useNavigate();

  const [appInfo, setAppInfo] = useState<DesktopAppInfo | null>(null);
  const [settings, setSettings] = useState<DesktopSettings>(DEFAULT_SETTINGS);
  const [windowState, setWindowState] = useState<WindowUIState>({
    isMaximized: false,
    isFullScreen: false,
    isFocused: true,
  });
  const [health, setHealth] = useState<ServerHealthResult | null>(null);
  const [checkingHealth, setCheckingHealth] = useState(false);

  // Settings modal state
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [draftServerUrl, setDraftServerUrl] = useState(DEFAULT_SETTINGS.serverUrl);
  const [draftMinimizeToTray, setDraftMinimizeToTray] = useState(false);
  const [draftNotifications, setDraftNotifications] = useState(true);
  const [draftFlashTaskbar, setDraftFlashTaskbar] = useState(true);
  const [draftTheme, setDraftTheme] = useState<DesktopThemeMode>('light');
  const [saveError, setSaveError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const serverInputRef = useRef<HTMLInputElement>(null);

  const modalRef = useDialogFocusTrap<HTMLDivElement>({
    isOpen: showSettingsModal,
    onClose: () => setShowSettingsModal(false),
    initialFocusRef: serverInputRef,
  });

  const runHealthCheck = useCallback(
    async (overrideUrl?: string) => {
      if (!desktopApi) return null;
      setCheckingHealth(true);
      try {
        const result = await desktopApi.checkServerHealth(overrideUrl);
        setHealth(result);
        return result;
      } finally {
        setCheckingHealth(false);
      }
    },
    [desktopApi]
  );

  const syncFormFromSettings = useCallback((next: DesktopSettings) => {
    setDraftServerUrl(next.serverUrl);
    setDraftMinimizeToTray(next.minimizeToTray);
    setDraftNotifications(next.notificationsEnabled);
    setDraftFlashTaskbar(next.flashTaskbar);
    setDraftTheme(next.theme);
  }, []);

  const applyRuntimeSettings = useCallback(
    (next: DesktopSettings) => {
      setSettings(next);
      syncFormFromSettings(next);
      updateApiServerUrl(next.serverUrl);
      updateSocketServerUrl(next.serverUrl);
      applyDesktopTheme(next.theme);
    },
    [syncFormFromSettings]
  );

  // Initial hydration + IPC listeners
  useEffect(() => {
    if (!desktopApi) return;
    let active = true;

    void (async () => {
      try {
        const [info, loadedSettings, winState] = await Promise.all([
          desktopApi.getAppInfo(),
          desktopApi.getSettings(),
          desktopApi.windowControls.getState(),
        ]);
        if (!active) return;
        setAppInfo(info);
        setWindowState(winState);
        applyRuntimeSettings(loadedSettings);
        await runHealthCheck(loadedSettings.serverUrl);
      } catch (err) {
        console.error('[desktop] Failed to initialize desktop bridge:', err);
      }
    })();

    const unsubWindow = desktopApi.onWindowStateChange((state) => setWindowState(state));
    const unsubNavigate = desktopApi.onNavigate((route) => {
      if (route && route.startsWith('/')) {
        navigate(route);
      }
    });
    const unsubOpenSettings = desktopApi.onOpenSettings(() => {
      setSaveError('');
      setSaveSuccess(false);
      setShowSettingsModal(true);
    });
    const unsubSettingsChanged = desktopApi.onSettingsChanged((updated) => {
      applyRuntimeSettings(updated);
    });
    const unsubThemeToggle = desktopApi.onThemeToggle(() => {
      setSettings((prev) => {
        const nextTheme: DesktopThemeMode = prev.theme === 'dark' ? 'light' : 'dark';
        void desktopApi.updateSettings({ theme: nextTheme });
        return { ...prev, theme: nextTheme };
      });
    });

    return () => {
      active = false;
      unsubWindow();
      unsubNavigate();
      unsubOpenSettings();
      unsubSettingsChanged();
      unsubThemeToggle();
    };
  }, [desktopApi, navigate, applyRuntimeSettings, runHealthCheck]);

  // Periodic background health check every 30 seconds
  useEffect(() => {
    if (!desktopApi) return;
    const interval = setInterval(() => {
      void runHealthCheck(settings.serverUrl);
    }, 30000);
    return () => clearInterval(interval);
  }, [desktopApi, settings.serverUrl, runHealthCheck]);

  if (!desktopApi) {
    return null;
  }

  const isMac = desktopApi.platform === 'darwin';

  const openModal = () => {
    syncFormFromSettings(settings);
    setSaveError('');
    setSaveSuccess(false);
    setShowSettingsModal(true);
    void runHealthCheck(settings.serverUrl);
  };

  const handleToggleQuickTheme = async () => {
    const nextTheme: DesktopThemeMode = settings.theme === 'dark' ? 'light' : 'dark';
    try {
      const updated = await desktopApi.updateSettings({ theme: nextTheme });
      applyRuntimeSettings(updated);
    } catch (err) {
      console.error('[desktop] Theme toggle failed:', err);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError('');
    setSaveSuccess(false);
    setIsSaving(true);

    try {
      const updated = await desktopApi.updateSettings({
        serverUrl: draftServerUrl,
        minimizeToTray: draftMinimizeToTray,
        notificationsEnabled: draftNotifications,
        flashTaskbar: draftFlashTaskbar,
        theme: draftTheme,
      });
      applyRuntimeSettings(updated);
      await runHealthCheck(updated.serverUrl);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2200);
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message.replace(/^Error invoking remote method '[^']+': Error: /, '')
          : 'Không thể lưu cài đặt. Kiểm tra lại địa chỉ máy chủ.';
      setSaveError(msg);
    } finally {
      setIsSaving(false);
    }
  };

  const serverHostLabel = (() => {
    try {
      return new URL(settings.serverUrl).host;
    } catch {
      return settings.serverUrl;
    }
  })();

  return (
    <>
      {/* Integrated Tournament Desktop Titlebar (36px) */}
      <div
        role="region"
        aria-label="Thanh tiêu đề ứng dụng desktop"
        className="sticky top-0 z-[80] h-9 w-full bg-slate-900 text-slate-100 border-b border-slate-800 flex items-center justify-between select-none desktop-drag-region"
      >
        {/* Left: App Brand Identity */}
        <div className={`flex items-center gap-2 min-w-0 ${isMac ? 'pl-20' : 'pl-3'}`}>
          <div className="w-5 h-5 rounded-md bg-slate-800 border border-slate-700 flex items-center justify-center flex-shrink-0">
            <PieceSvg type="k" color="w" className="w-3.5 h-3.5" />
          </div>
          <span className="text-xs font-bold tracking-tight text-white truncate">
            Online Chess Desktop
          </span>
          {appInfo && (
            <span className="hidden sm:inline-block text-[11px] font-mono tabular-nums text-slate-400">
              v{appInfo.appVersion}
            </span>
          )}
        </div>

        {/* Right: Server Health, Theme, Settings & Native Window Controls */}
        <div className="flex items-center h-full desktop-no-drag">
          <button
            type="button"
            onClick={openModal}
            aria-label="Mở cài đặt kết nối máy chủ"
            title={`Máy chủ: ${settings.serverUrl}`}
            className="h-7 px-2.5 mr-1 rounded-lg text-[11px] font-medium flex items-center gap-1.5 text-slate-200 hover:bg-slate-800 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
          >
            {checkingHealth ? (
              <>
                <Loader2 className="w-3.5 h-3.5 text-sky-400 animate-spin" aria-hidden="true" />
                <span className="text-slate-300">Đang kiểm tra...</span>
              </>
            ) : health?.ok ? (
              <>
                <Wifi className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
                <span className="hidden sm:inline text-slate-200">{serverHostLabel}</span>
                <span className="font-mono tabular-nums text-emerald-300">
                  {health.latencyMs} ms
                </span>
              </>
            ) : (
              <>
                <WifiOff className="w-3.5 h-3.5 text-rose-400" aria-hidden="true" />
                <span className="text-rose-300">Chưa kết nối</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleToggleQuickTheme}
            aria-label={
              settings.theme === 'dark'
                ? 'Chuyển sang giao diện sáng'
                : 'Chuyển sang giao diện tối'
            }
            title="Chuyển giao diện Sáng / Tối (Ctrl+Shift+D)"
            className="h-7 w-7 mr-1 rounded-lg flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-800 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
          >
            {settings.theme === 'dark' ? (
              <Sun className="w-3.5 h-3.5" aria-hidden="true" />
            ) : (
              <Moon className="w-3.5 h-3.5" aria-hidden="true" />
            )}
          </button>

          <button
            type="button"
            onClick={openModal}
            aria-label="Cài đặt ứng dụng desktop"
            title="Cài đặt ứng dụng & máy chủ (Ctrl+,)"
            className="h-7 w-7 mr-1.5 rounded-lg flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-800 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" aria-hidden="true" />
          </button>

          {!isMac && (
            <div className="flex items-center h-full border-l border-slate-800">
              <button
                type="button"
                onClick={() => void desktopApi.windowControls.minimize()}
                aria-label="Thu nhỏ cửa sổ"
                className="h-full w-11 flex items-center justify-center text-slate-300 hover:bg-slate-800 hover:text-white transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sky-500"
              >
                <Minus className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => void desktopApi.windowControls.toggleMaximize()}
                aria-label={windowState.isMaximized ? 'Khôi phục kích thước cửa sổ' : 'Phóng to cửa sổ'}
                className="h-full w-11 flex items-center justify-center text-slate-300 hover:bg-slate-800 hover:text-white transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sky-500"
              >
                {windowState.isMaximized ? (
                  <Minimize2 className="w-3.5 h-3.5" aria-hidden="true" />
                ) : (
                  <Maximize2 className="w-3.5 h-3.5" aria-hidden="true" />
                )}
              </button>
              <button
                type="button"
                onClick={() => void desktopApi.windowControls.close()}
                aria-label="Đóng cửa sổ"
                className="h-full w-11 flex items-center justify-center text-slate-300 hover:bg-rose-600 hover:text-white transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-rose-400"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Desktop Settings & Server Configuration Modal */}
      {showSettingsModal && (
        <div className="fixed inset-x-0 bottom-0 top-9 z-[70] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div
            ref={modalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="desktop-settings-title"
            className="w-full max-w-lg max-h-[85dvh] overflow-y-auto bg-white rounded-2xl p-6 border border-slate-200 shadow-modal text-slate-800"
          >
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center flex-shrink-0">
                  <Server className="w-4 h-4" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <h2
                    id="desktop-settings-title"
                    className="text-base font-bold text-slate-900 tracking-tight truncate"
                  >
                    Cài đặt ứng dụng Desktop
                  </h2>
                  <p className="text-xs text-slate-500">
                    Kết nối máy chủ, thông báo hệ thống và giao diện
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSettingsModal(false)}
                aria-label="Đóng hộp thoại cài đặt"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={handleSaveSettings} className="mt-5 space-y-5">
              {/* Server URL section */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <label
                    htmlFor="desktop-server-url"
                    className="text-xs font-semibold text-slate-700"
                  >
                    Địa chỉ máy chủ Backend (API & Socket.IO)
                  </label>
                  <button
                    type="button"
                    onClick={() => setDraftServerUrl('http://localhost:4000')}
                    className="text-xs font-medium text-sky-700 hover:text-sky-900 underline-offset-2 hover:underline"
                  >
                    Dùng mặc định cục bộ
                  </button>
                </div>

                <div className="flex gap-2">
                  <input
                    ref={serverInputRef}
                    id="desktop-server-url"
                    type="url"
                    value={draftServerUrl}
                    onChange={(e) => setDraftServerUrl(e.target.value)}
                    placeholder="http://localhost:4000"
                    required
                    className="flex-1 min-w-0 min-h-[44px] px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-base sm:text-sm font-mono text-slate-900 focus:bg-white focus:border-sky-600 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => void runHealthCheck(draftServerUrl)}
                    disabled={checkingHealth}
                    className="min-h-[44px] px-3.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold inline-flex items-center gap-1.5 active:scale-[0.98] transition-[background-color,transform] duration-150 ease-out"
                  >
                    <RefreshCw
                      className={`w-3.5 h-3.5 ${checkingHealth ? 'animate-spin text-sky-600' : ''}`}
                      aria-hidden="true"
                    />
                    <span>Kiểm tra</span>
                  </button>
                </div>

                {/* Live Health Result */}
                {health && (
                  <div
                    role="status"
                    className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 ${
                      health.ok
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                        : 'bg-rose-50 border-rose-200 text-rose-800'
                    }`}
                  >
                    {health.ok ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" aria-hidden="true" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" aria-hidden="true" />
                    )}
                    <div className="min-w-0 space-y-0.5">
                      <p className="font-semibold">
                        {health.ok
                          ? `Kết nối thành công (${health.latencyMs} ms)`
                          : 'Không thể kết nối máy chủ'}
                      </p>
                      <p className="text-[11px] opacity-90 break-all">
                        {health.ok
                          ? `${health.serverUrl}${health.database ? ` • CSDL: ${health.database}` : ''}`
                          : health.error}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Theme Mode */}
              <div className="space-y-2">
                <span className="block text-xs font-semibold text-slate-700">
                  Chế độ hiển thị
                </span>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      { value: 'light', label: 'Sáng' },
                      { value: 'dark', label: 'Tối' },
                      { value: 'system', label: 'Theo hệ thống' },
                    ] as const
                  ).map((opt) => {
                    const active = draftTheme === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setDraftTheme(opt.value)}
                        className={`min-h-[44px] px-3 py-2 rounded-xl text-xs font-semibold border transition-colors duration-150 ${
                          active
                            ? 'bg-slate-900 text-white border-slate-900'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Desktop Behavior Toggles */}
              <div className="space-y-2.5 pt-1">
                <span className="block text-xs font-semibold text-slate-700">
                  Tiện ích Desktop
                </span>

                <label className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200/80 cursor-pointer hover:bg-slate-100/70 transition-colors">
                  <input
                    type="checkbox"
                    checked={draftNotifications}
                    onChange={(e) => setDraftNotifications(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-sky-700 focus:ring-sky-500"
                  />
                  <span className="text-xs text-slate-700 leading-relaxed">
                    <strong className="block text-slate-900 font-semibold">
                      Thông báo hệ thống khi đến lượt đi
                    </strong>
                    Hiển thị thông báo gốc khi cửa sổ đang ẩn và đối thủ đi nước mới hoặc đề nghị hòa.
                  </span>
                </label>

                <label className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200/80 cursor-pointer hover:bg-slate-100/70 transition-colors">
                  <input
                    type="checkbox"
                    checked={draftFlashTaskbar}
                    onChange={(e) => setDraftFlashTaskbar(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-sky-700 focus:ring-sky-500"
                  />
                  <span className="text-xs text-slate-700 leading-relaxed">
                    <strong className="block text-slate-900 font-semibold">
                      Nhấp nháy thanh tác vụ (Taskbar)
                    </strong>
                    Nhắc chú ý trên thanh tác vụ khi có trận mới hoặc lượt đi quan trọng.
                  </span>
                </label>

                <label className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200/80 cursor-pointer hover:bg-slate-100/70 transition-colors">
                  <input
                    type="checkbox"
                    checked={draftMinimizeToTray}
                    onChange={(e) => setDraftMinimizeToTray(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-sky-700 focus:ring-sky-500"
                  />
                  <span className="text-xs text-slate-700 leading-relaxed">
                    <strong className="block text-slate-900 font-semibold">
                      Thu nhỏ xuống khay hệ thống khi đóng
                    </strong>
                    Giữ ứng dụng chạy nền ở khay hệ thống thay vì thoát hoàn toàn khi bấm nút đóng.
                  </span>
                </label>
              </div>

              {saveError && (
                <div
                  role="alert"
                  className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2"
                >
                  <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>{saveError}</span>
                </div>
              )}

              {saveSuccess && (
                <div
                  role="status"
                  className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>Đã lưu cài đặt và áp dụng kết nối mới.</span>
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowSettingsModal(false)}
                  className="min-h-[44px] px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-colors"
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="min-h-[44px] px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold active:scale-[0.98] transition-[background-color,transform] duration-150 ease-out disabled:opacity-60"
                >
                  {isSaving ? 'Đang lưu...' : 'Lưu cài đặt'}
                </button>
              </div>

              {appInfo && (
                <div className="pt-2 text-[11px] text-slate-500 font-mono tabular-nums flex flex-wrap items-center justify-between gap-2">
                  <span>
                    Electron {appInfo.electronVersion} • Chromium {appInfo.chromeVersion}
                  </span>
                  <span>Phím tắt: Ctrl+,</span>
                </div>
              )}
            </form>
          </div>
        </div>
      )}
    </>
  );
}
