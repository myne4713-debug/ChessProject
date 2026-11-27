import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { useAuthStore } from '../../stores/authStore';
import { reconnectSocketWithAuth } from '../../services/socket';
import { useDialogFocusTrap } from '../../hooks/useDialogFocusTrap';
import {
  getDesktopApi,
  isElectronDesktop,
  parseDesktopAuthCallback,
} from '../../lib/desktop';
import { KeyRound, X, AlertCircle, Info, ExternalLink } from 'lucide-react';

declare global {
  interface Window {
    google?: any;
  }
}

interface GoogleLoginButtonProps {
  text?: string;
  className?: string;
}

const DEFAULT_GOOGLE_CLIENT_ID =
  '681861375668-f0ri0q69lv7cqdhh3s250aa7cd5ed4cq.apps.googleusercontent.com';

export default function GoogleLoginButton({
  text = 'Đăng nhập với Google',
  className = '',
}: GoogleLoginButtonProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const setAuth = useAuthStore((s) => s.setAuth);
  const inDesktop = isElectronDesktop();
  const desktopCallback = inDesktop ? null : parseDesktopAuthCallback(location.search);

  const [isLoading, setIsLoading] = useState(false);
  const [waitingBrowser, setWaitingBrowser] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [authFeedback, setAuthFeedback] = useState<{
    type: 'error' | 'info';
    message: string;
  } | null>(null);

  const configModalRef = useDialogFocusTrap<HTMLDivElement>({
    isOpen: showConfigModal,
    onClose: () => setShowConfigModal(false),
  });

  // Read client ID with fallback to your configured client ID
  const envClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
  const [clientId, setClientId] = useState(
    envClientId ||
      localStorage.getItem('online_chess_google_client_id') ||
      DEFAULT_GOOGLE_CLIENT_ID
  );
  const [inputClientId, setInputClientId] = useState(clientId);

  const tokenClientRef = useRef<any>(null);

  // Load Google Identity Services SDK only in browser context (Electron uses system browser broker)
  useEffect(() => {
    if (inDesktop) return;

    const scriptId = 'google-gsi-client';
    if (!document.getElementById(scriptId)) {
      const script = document.createElement('script');
      script.id = scriptId;
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => {
        initClient();
      };
      document.body.appendChild(script);
    } else {
      initClient();
    }

    function initClient() {
      if (!window.google?.accounts?.oauth2 || !clientId) return;
      try {
        tokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: 'email profile openid',
          callback: async (tokenResponse: any) => {
            if (tokenResponse?.error) {
              setIsLoading(false);
              return;
            }
            if (tokenResponse?.access_token) {
              await handleAccessToken(tokenResponse.access_token);
            }
          },
        });
        setAuthFeedback((prev) => (prev?.type === 'info' ? null : prev));
      } catch (err) {
        console.error('Failed to init Google OAuth client', err);
      }
    }
  }, [clientId, inDesktop]);

  // Cancel any pending system-browser auth if component unmounts
  useEffect(() => {
    return () => {
      if (inDesktop) {
        void getDesktopApi()?.cancelGoogleAuth?.();
      }
    };
  }, [inDesktop]);

  const handleAccessToken = async (accessToken: string) => {
    // If opened in browser on behalf of Online Chess Desktop, hand token back to loopback callback
    if (desktopCallback) {
      const redirectUrl = `${desktopCallback.callbackUrl}?state=${encodeURIComponent(
        desktopCallback.state
      )}&googleAccessToken=${encodeURIComponent(accessToken)}`;
      window.location.assign(redirectUrl);
      return;
    }

    setAuthFeedback(null);
    setIsLoading(true);
    try {
      // Send token to backend for authoritative verification
      const res = await api.post('/auth/google', {
        accessToken,
      });

      if (res.data.success && res.data.data) {
        setAuth(res.data.data.user, res.data.data.accessToken);
        reconnectSocketWithAuth();
        navigate('/lobby');
      }
    } catch (err: any) {
      setAuthFeedback({
        type: 'error',
        message:
          err.response?.data?.message ||
          'Không thể đăng nhập bằng tài khoản Google. Kiểm tra kết nối và thử lại.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDesktopGoogleLogin = async () => {
    const desktopApi = getDesktopApi();
    if (!desktopApi?.startGoogleAuth) {
      setAuthFeedback({
        type: 'error',
        message: 'Phiên bản Desktop hiện tại chưa hỗ trợ đăng nhập Google qua trình duyệt ngoài.',
      });
      return;
    }

    setAuthFeedback({
      type: 'info',
      message:
        'Đã mở trình duyệt hệ thống để xác thực Google. Hoàn tất trên trình duyệt để tự động quay lại ứng dụng.',
    });
    setIsLoading(true);
    setWaitingBrowser(true);

    try {
      const result = await desktopApi.startGoogleAuth();
      setWaitingBrowser(false);
      if (result?.accessToken) {
        await handleAccessToken(result.accessToken);
      }
    } catch (err: unknown) {
      const rawMessage =
        err instanceof Error
          ? err.message.replace(/^Error invoking remote method '[^']+': Error: /, '')
          : 'Không thể hoàn tất đăng nhập Google trên trình duyệt.';
      setAuthFeedback({
        type: 'error',
        message: rawMessage,
      });
    } finally {
      setWaitingBrowser(false);
      setIsLoading(false);
    }
  };

  const handleCancelDesktopAuth = () => {
    void getDesktopApi()?.cancelGoogleAuth?.();
    setWaitingBrowser(false);
    setIsLoading(false);
  };

  const handleClick = () => {
    if (inDesktop) {
      void handleDesktopGoogleLogin();
      return;
    }

    setAuthFeedback(null);
    const activeClientId = clientId || DEFAULT_GOOGLE_CLIENT_ID;

    if (!window.google?.accounts?.oauth2) {
      setAuthFeedback({
        type: 'info',
        message: 'Dịch vụ đăng nhập Google đang tải. Chờ vài giây rồi nhấn lại.',
      });
      return;
    }

    setIsLoading(true);

    try {
      // Initialize or reuse tokenClient with activeClientId
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: activeClientId,
        scope: 'email profile openid',
        callback: async (tokenResponse: any) => {
          if (tokenResponse?.error) {
            setIsLoading(false);
            return;
          }
          if (tokenResponse?.access_token) {
            await handleAccessToken(tokenResponse.access_token);
          }
        },
      });

      // Launch Google's Official Popup "Choose an account"
      client.requestAccessToken({ prompt: 'select_account' });
    } catch (err) {
      console.error(err);
      setIsLoading(false);
      setShowConfigModal(true);
    }
  };

  const handleSaveClientId = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputClientId.trim()) return;
    setAuthFeedback(null);
    const cleanId = inputClientId.trim();
    setClientId(cleanId);
    localStorage.setItem('online_chess_google_client_id', cleanId);
    setShowConfigModal(false);

    // Prompt Google popup immediately
    setTimeout(() => {
      try {
        if (window.google?.accounts?.oauth2) {
          const client = window.google.accounts.oauth2.initTokenClient({
            client_id: cleanId,
            scope: 'email profile openid',
            callback: async (tokenResponse: any) => {
              if (tokenResponse?.access_token) {
                await handleAccessToken(tokenResponse.access_token);
              }
            },
          });
          client.requestAccessToken({ prompt: 'select_account' });
        }
      } catch (e) {
        console.error(e);
      }
    }, 300);
  };

  return (
    <>
      <div className="w-full">
        <button
          type="button"
          onClick={handleClick}
          disabled={isLoading}
          className={`w-full py-2.5 min-h-[44px] px-4 bg-white hover:bg-slate-50/90 active:scale-[0.98] border border-slate-200/90 text-slate-700 font-semibold rounded-xl text-xs sm:text-sm shadow-subtle hover:border-slate-300 transition-[background-color,border-color,transform] duration-150 ease-out flex items-center justify-center gap-3 relative overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 ${className}`}
        >
          {isLoading ? (
            <div className="w-4 h-4 border-2 border-sky-600 border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              {/* Google Colorful G SVG */}
              <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  fill="#EA4335"
                />
              </svg>
              <span>{text}</span>
              {inDesktop && (
                <ExternalLink className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" aria-hidden="true" />
              )}
            </>
          )}
        </button>

        {authFeedback &&
          (authFeedback.type === 'error' ? (
            <div
              role="alert"
              className="mt-2 p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-start gap-2 animate-in fade-in duration-150"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" aria-hidden="true" />
              <span>{authFeedback.message}</span>
            </div>
          ) : (
            <div
              role="status"
              aria-live="polite"
              className="mt-2 p-2.5 rounded-xl bg-sky-50 border border-sky-200 text-sky-800 text-xs font-medium flex items-start justify-between gap-2 animate-in fade-in duration-150"
            >
              <div className="flex items-start gap-2 min-w-0">
                <Info className="w-4 h-4 shrink-0 mt-0.5 text-sky-600" aria-hidden="true" />
                <span>{authFeedback.message}</span>
              </div>
              {waitingBrowser && (
                <button
                  type="button"
                  onClick={handleCancelDesktopAuth}
                  className="shrink-0 px-2.5 py-1 rounded-lg bg-white border border-sky-200 text-sky-800 hover:bg-sky-100 font-semibold text-xs transition-colors"
                >
                  Hủy
                </button>
              )}
            </div>
          ))}
      </div>

      {/* Config Client ID Modal (Only fallback if user wants to change) */}
      {showConfigModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-150">
          <div
            ref={configModalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="google-config-title"
            className="w-full max-w-md max-h-[90dvh] overflow-y-auto bg-white rounded-2xl p-6 border border-slate-200/90 shadow-modal animate-in zoom-in-95 duration-150"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2 min-w-0">
                <KeyRound className="w-5 h-5 shrink-0 text-sky-600" />
                <h2 id="google-config-title" className="font-bold text-slate-900 text-sm truncate">
                  Cấu Hình Google OAuth Client ID
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowConfigModal(false)}
                aria-label="Đóng cấu hình Google Client ID"
                className="text-slate-500 hover:text-slate-700 p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 mt-3 mb-4 leading-relaxed">
              Google Client ID hiện tại của bạn:
            </p>

            <form onSubmit={handleSaveClientId} className="space-y-4">
              <div>
                <label htmlFor="google-oauth-client-id" className="block text-xs font-semibold text-slate-600 mb-1.5">
                  Google Client ID (.apps.googleusercontent.com)
                </label>
                <input
                  id="google-oauth-client-id"
                  type="text"
                  value={inputClientId}
                  onChange={(e) => setInputClientId(e.target.value)}
                  placeholder="xxxx-xxxxxxxx.apps.googleusercontent.com"
                  className="w-full min-h-[44px] px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-base sm:text-sm font-mono focus:outline-none focus:border-sky-500 focus:bg-white focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-1"
                  required
                />
              </div>

              <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowConfigModal(false)}
                  className="flex-1 py-2.5 min-h-[44px] px-3 border border-slate-200 text-slate-600 rounded-xl text-xs font-semibold hover:bg-slate-50 transition-colors"
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 min-h-[44px] px-3 bg-sky-700 text-white rounded-xl text-xs font-bold hover:bg-sky-800 active:scale-[0.98] transition-colors shadow-sm"
                >
                  Kích Hoạt Popup Google
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
