import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { Routes, Route, Link, Navigate, useNavigate, useLocation } from 'react-router-dom';
import {
  Trophy,
  Swords,
  Bot,
  User,
  LogIn,
  LogOut,
  ShieldAlert,
  History,
  Menu,
  X,
} from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { PieceSvg } from '../components/chess/PieceSvg';
import { DesktopShellBar } from '../components/desktop/DesktopShellBar';
import { isElectronDesktop } from '../lib/desktop';

const LandingPage = lazy(() => import('../features/home/LandingPage'));

const LoginPage = lazy(() => import('../features/auth/LoginPage'));
const RegisterPage = lazy(() => import('../features/auth/RegisterPage'));
const VerifyEmailPage = lazy(() => import('../features/auth/VerifyEmailPage'));
const LobbyPage = lazy(() => import('../features/lobby/LobbyPage'));
const GamePage = lazy(() => import('../features/game/GamePage'));
const AIGamePage = lazy(() => import('../features/game/AIGamePage'));
const ProfilePage = lazy(() => import('../features/profile/ProfilePage'));
const GameReplayPage = lazy(() => import('../features/game/GameReplayPage'));
const LeaderboardPage = lazy(() => import('../features/leaderboard/LeaderboardPage'));
const AdminPage = lazy(() => import('../features/admin/AdminPage'));

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const location = useLocation();

  if (!isAuthenticated) {
    return (
      <Navigate
        to="/login"
        state={{ from: `${location.pathname}${location.search}` }}
        replace
      />
    );
  }

  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user } = useAuthStore();
  const location = useLocation();

  if (!isAuthenticated) {
    return (
      <Navigate
        to="/login"
        state={{ from: `${location.pathname}${location.search}` }}
        replace
      />
    );
  }

  if (user?.role !== 'ADMIN') {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  const { user, isAuthenticated, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const mobileMenuBtnRef = useRef<HTMLButtonElement>(null);

  const handleLogout = () => {
    logout();
    navigate('/');
    setMobileMenuOpen(false);
  };

  const isActive = (path: string) => location.pathname === path;
  const closeMobileMenu = () => setMobileMenuOpen(false);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMobileMenuOpen(false);
        mobileMenuBtnRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileMenuOpen]);

  return (
    <div className="min-h-screen flex flex-col bg-chess-bg text-slate-800 antialiased selection:bg-sky-100 selection:text-sky-900">
      <DesktopShellBar />
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:px-4 focus:py-2.5 focus:rounded-xl focus:bg-slate-900 focus:text-white focus:text-sm focus:font-bold focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
      >
        Chuyển đến nội dung chính
      </a>
      {/* Header / Navigation Bar */}
      <header
        className={`border-b border-slate-200/90 bg-white/95 backdrop-blur-md sticky ${
          isElectronDesktop() ? 'top-9' : 'top-0'
        } z-50 transition-colors safe-x`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          {/* Brand Logo */}
          <Link
            to="/"
            onClick={closeMobileMenu}
            className="flex items-center gap-3 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 rounded-xl py-1 px-1.5"
          >
            <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-white shadow-sm group-hover:scale-105 active:scale-95 transition-transform duration-150">
              <PieceSvg type="k" color="w" className="w-6 h-6 drop-shadow-sm" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-lg tracking-tight text-slate-900 group-hover:text-sky-700 transition-colors">
                  Online Chess
                </span>
                <span className="hidden sm:inline-block text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200/80">
                  Đấu trường cờ vua
                </span>
              </div>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav aria-label="Điều hướng chính" className="hidden md:flex items-center gap-1.5 text-sm font-medium">
            <Link
              to="/lobby"
              aria-current={isActive('/lobby') ? 'page' : undefined}
              className={`px-3.5 py-2 rounded-xl transition-colors duration-150 flex items-center gap-2 ${
                isActive('/lobby')
                  ? 'bg-sky-50 text-sky-700 font-semibold shadow-subtle'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
              }`}
            >
              <Swords className="w-4 h-4 text-sky-600" />
              Sảnh chờ
            </Link>
            <Link
              to="/ai"
              aria-current={isActive('/ai') ? 'page' : undefined}
              className={`px-3.5 py-2 rounded-xl transition-colors duration-150 flex items-center gap-2 ${
                isActive('/ai')
                  ? 'bg-sky-50 text-sky-700 font-semibold shadow-subtle'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
              }`}
            >
              <Bot className="w-4 h-4 text-sky-600" />
              Đấu với Máy
            </Link>
            <Link
              to="/leaderboard"
              aria-current={isActive('/leaderboard') ? 'page' : undefined}
              className={`px-3.5 py-2 rounded-xl transition-colors duration-150 flex items-center gap-2 ${
                isActive('/leaderboard')
                  ? 'bg-sky-50 text-sky-700 font-semibold shadow-subtle'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
              }`}
            >
              <Trophy className="w-4 h-4 text-amber-500" />
              Bảng xếp hạng
            </Link>
            {isAuthenticated && (
              <Link
                to="/history"
                aria-current={isActive('/history') ? 'page' : undefined}
                className={`px-3.5 py-2 rounded-xl transition-colors duration-150 flex items-center gap-2 ${
                  isActive('/history')
                    ? 'bg-sky-50 text-sky-700 font-semibold shadow-subtle'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                }`}
              >
                <History className="w-4 h-4 text-sky-600" />
                Lịch sử đấu
              </Link>
            )}
            {user?.role === 'ADMIN' && (
              <Link
                to="/admin"
                aria-current={isActive('/admin') ? 'page' : undefined}
                className={`px-3.5 py-2 rounded-xl transition-colors duration-150 flex items-center gap-2 ${
                  isActive('/admin')
                    ? 'bg-amber-50 text-amber-900 font-semibold shadow-subtle'
                    : 'text-amber-700 hover:text-amber-900 hover:bg-amber-50/70'
                }`}
              >
                <ShieldAlert className="w-4 h-4 text-amber-600" />
                Quản trị
              </Link>
            )}
          </nav>

          {/* Desktop User Account Area */}
          <div className="hidden md:flex items-center gap-3">
            {isAuthenticated && user ? (
              <div className="flex items-center gap-2.5">
                <Link
                  to="/profile"
                  className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-sm transition-colors duration-150 shadow-subtle hover:border-slate-300"
                >
                  <div className="w-7 h-7 rounded-lg bg-slate-900 flex items-center justify-center text-xs font-bold text-white shadow-sm overflow-hidden flex-shrink-0">
                    {user.avatarUrl ? (
                      <img
                        src={user.avatarUrl}
                        alt={user.displayName || user.username}
                        width={28}
                        height={28}
                        decoding="async"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      (user.displayName || user.username).slice(0, 1).toUpperCase()
                    )}
                  </div>
                  <span className="font-semibold text-slate-800 max-w-[120px] truncate">
                    {user.displayName || user.username}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 font-mono font-bold border border-sky-100 tabular-nums">
                    {user.eloRating} ELO
                  </span>
                </Link>
                <button
                  onClick={handleLogout}
                  aria-label="Đăng xuất tài khoản"
                  title="Đăng xuất"
                  className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-500 hover:text-rose-700 hover:bg-rose-50 transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-rose-500"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  to="/login"
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 rounded-xl transition-colors duration-150 flex items-center gap-1.5"
                >
                  <LogIn className="w-4 h-4" />
                  Đăng nhập
                </Link>
                <Link
                  to="/register"
                  className="px-4 py-2 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 active:scale-[0.98] rounded-xl shadow-sm transition-[background-color,transform] duration-150 ease-out flex items-center gap-1.5"
                >
                  <User className="w-4 h-4" />
                  Đăng ký
                </Link>
              </div>
            )}
          </div>

          {/* Mobile Menu Toggle Button */}
          <div className="flex md:hidden items-center gap-2">
            <button
              ref={mobileMenuBtnRef}
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label={mobileMenuOpen ? 'Đóng menu' : 'Mở menu điều hướng'}
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-nav-drawer"
              className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors focus-visible:ring-2 focus-visible:ring-sky-500"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <nav
            id="mobile-nav-drawer"
            aria-label="Điều hướng di động"
            className="md:hidden border-t border-slate-200/90 bg-white px-4 py-4 space-y-2 shadow-lg animate-in fade-in slide-in-from-top-2 duration-150"
          >
            <Link
              to="/lobby"
              onClick={closeMobileMenu}
              aria-current={isActive('/lobby') ? 'page' : undefined}
              className={`flex items-center gap-3 px-3.5 py-2.5 min-h-[44px] rounded-xl text-sm font-medium transition-colors ${
                isActive('/lobby')
                  ? 'bg-sky-50 text-sky-700 font-semibold'
                  : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              <Swords className="w-4 h-4 text-sky-600" />
              Sảnh chờ
            </Link>
            <Link
              to="/ai"
              onClick={closeMobileMenu}
              aria-current={isActive('/ai') ? 'page' : undefined}
              className={`flex items-center gap-3 px-3.5 py-2.5 min-h-[44px] rounded-xl text-sm font-medium transition-colors ${
                isActive('/ai')
                  ? 'bg-sky-50 text-sky-700 font-semibold'
                  : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              <Bot className="w-4 h-4 text-sky-600" />
              Đấu với Máy
            </Link>
            <Link
              to="/leaderboard"
              onClick={closeMobileMenu}
              aria-current={isActive('/leaderboard') ? 'page' : undefined}
              className={`flex items-center gap-3 px-3.5 py-2.5 min-h-[44px] rounded-xl text-sm font-medium transition-colors ${
                isActive('/leaderboard')
                  ? 'bg-sky-50 text-sky-700 font-semibold'
                  : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              <Trophy className="w-4 h-4 text-amber-500" />
              Bảng xếp hạng
            </Link>
            {isAuthenticated && (
              <Link
                to="/history"
                onClick={closeMobileMenu}
                aria-current={isActive('/history') ? 'page' : undefined}
                className={`flex items-center gap-3 px-3.5 py-2.5 min-h-[44px] rounded-xl text-sm font-medium transition-colors ${
                  isActive('/history')
                    ? 'bg-sky-50 text-sky-700 font-semibold'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <History className="w-4 h-4 text-sky-600" />
                Lịch sử đấu
              </Link>
            )}
            {user?.role === 'ADMIN' && (
              <Link
                to="/admin"
                onClick={closeMobileMenu}
                aria-current={isActive('/admin') ? 'page' : undefined}
                className={`flex items-center gap-3 px-3.5 py-2.5 min-h-[44px] rounded-xl text-sm font-medium transition-colors ${
                  isActive('/admin')
                    ? 'bg-amber-50 text-amber-800 font-semibold'
                    : 'text-amber-700 hover:bg-amber-50'
                }`}
              >
                <ShieldAlert className="w-4 h-4 text-amber-600" />
                Quản trị
              </Link>
            )}

            <div className="pt-3 border-t border-slate-100">
              {isAuthenticated && user ? (
                <div className="space-y-2">
                  <Link
                    to="/profile"
                    onClick={closeMobileMenu}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200/80"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-slate-900 text-white flex items-center justify-center text-xs font-bold overflow-hidden flex-shrink-0">
                        {user.avatarUrl ? (
                          <img
                            src={user.avatarUrl}
                            alt={user.displayName || user.username}
                            width={28}
                            height={28}
                            decoding="async"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          (user.displayName || user.username).slice(0, 1).toUpperCase()
                        )}
                      </div>
                      <span className="font-semibold text-sm text-slate-900 truncate max-w-[150px]">
                        {user.displayName || user.username}
                      </span>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-sky-100 text-sky-700 font-bold tabular-nums">
                      {user.eloRating} ELO
                    </span>
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="w-full py-2.5 min-h-[44px] rounded-xl text-rose-600 hover:bg-rose-50 font-semibold text-sm transition-colors flex items-center justify-center gap-2"
                  >
                    <LogOut className="w-4 h-4" />
                    Đăng xuất
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <Link
                    to="/login"
                    onClick={closeMobileMenu}
                    className="py-2.5 min-h-[44px] flex items-center justify-center text-center text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                  >
                    Đăng nhập
                  </Link>
                  <Link
                    to="/register"
                    onClick={closeMobileMenu}
                    className="py-2.5 min-h-[44px] flex items-center justify-center text-center text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-colors"
                  >
                    Đăng ký
                  </Link>
                </div>
              )}
            </div>
          </nav>
        )}
      </header>

      {/* Email Verification Alert Banner */}
      {isAuthenticated && user && !user.isEmailVerified && (
        <div className="bg-amber-50 border-b border-amber-200/80 px-4 py-2.5 text-xs text-amber-800 flex flex-wrap items-center justify-center gap-2 text-center animate-in fade-in duration-150 safe-x">
          <ShieldAlert className="w-4 h-4 text-amber-600 flex-shrink-0" />
          <span>Địa chỉ email của bạn chưa được xác minh.</span>
          <Link
            to={`/verify-email?email=${encodeURIComponent(user.email)}`}
            className="font-bold underline hover:text-amber-900 ml-1 inline-flex items-center min-h-[44px] sm:min-h-0 px-1"
          >
            Nhập mã xác minh ngay
          </Link>
        </div>
      )}

      {/* Main View Router */}
      <main id="main-content" tabIndex={-1} className="flex-1 flex flex-col focus:outline-none">
        <Suspense
          fallback={
            <div className="flex-1 flex items-center justify-center p-12 text-slate-500">
              <div className="w-7 h-7 border-2 border-sky-700 border-t-transparent rounded-full animate-spin" />
            </div>
          }
        >
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/verify-email" element={<VerifyEmailPage />} />
            <Route path="/lobby" element={<LobbyPage />} />
            <Route path="/game/:id" element={<GamePage />} />
            <Route path="/ai" element={<AIGamePage />} />
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <ProfilePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/history"
              element={
                <ProtectedRoute>
                  <GameReplayPage />
                </ProtectedRoute>
              }
            />
            <Route path="/leaderboard" element={<LeaderboardPage />} />
            <Route
              path="/admin"
              element={
                <AdminRoute>
                  <AdminPage />
                </AdminRoute>
              }
            />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200/80 bg-white pt-10 text-xs text-slate-500 safe-x safe-bottom">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-slate-900 flex items-center justify-center text-white">
              <PieceSvg type="k" color="w" className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold text-slate-800 text-sm">Online Chess Platform</span>
              <p className="text-xs text-slate-600">Đấu trường cờ vua trực tuyến thời gian thực & AI Minimax</p>
            </div>
          </div>

          <div className="text-center md:text-left text-slate-500">
            Đồ án cơ sở 4 - Kiến trúc Client-Server WebSocket & Công nghệ Trí tuệ Nhân tạo
          </div>

          <div className="flex flex-wrap items-center justify-center gap-5 font-medium text-slate-600">
            <Link to="/lobby" className="hover:text-slate-900 transition-colors inline-flex items-center min-h-[44px] sm:min-h-0 px-1">Sảnh thi đấu</Link>
            <Link to="/ai" className="hover:text-slate-900 transition-colors inline-flex items-center min-h-[44px] sm:min-h-0 px-1">Máy tập luyện</Link>
            <Link to="/leaderboard" className="hover:text-slate-900 transition-colors inline-flex items-center min-h-[44px] sm:min-h-0 px-1">Bảng xếp hạng</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function NotFoundPage() {
  return (
    <div className="p-16 text-center max-w-lg mx-auto my-auto">
      <div className="w-16 h-16 rounded-2xl bg-rose-50 text-rose-600 border border-rose-200/80 mx-auto flex items-center justify-center text-2xl font-bold mb-4">
        404
      </div>
      <h1 className="text-2xl font-bold text-slate-900 mb-2">Không tìm thấy trang</h1>
      <p className="text-slate-500 mb-6 text-sm">
        Trang bạn đang truy cập không tồn tại hoặc đã được chuyển sang địa chỉ khác.
      </p>
      <Link
        to="/"
        className="inline-flex px-5 py-2.5 bg-slate-900 hover:bg-slate-800 rounded-xl text-white font-semibold text-sm shadow-sm transition-[background-color,transform] duration-150 ease-out active:scale-[0.98]"
      >
        Về trang chủ
      </Link>
    </div>
  );
}
