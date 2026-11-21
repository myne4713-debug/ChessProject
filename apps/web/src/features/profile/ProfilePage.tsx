import { useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../../services/api';
import { useAuthStore } from '../../stores/authStore';
import {
  Swords,
  Key,
  AlertCircle,
  CheckCircle,
  ShieldCheck,
  User,
  Image as ImageIcon,
  Sparkles,
  RefreshCw,
  UploadCloud,
  Camera,
  Trash2,
} from 'lucide-react';

const PRESET_AVATARS = [
  { name: 'Vua Trắng', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=KingWhite' },
  { name: 'Hậu Tím', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=QueenViolet' },
  { name: 'Mã Vàng', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=KnightGold' },
  { name: 'Tượng Ngọc', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=BishopEmerald' },
  { name: 'Xe Lam', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=RookCyan' },
  { name: 'Đại Kiện Tướng', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=GrandmasterChess' },
  { name: 'Chiến Binh AI', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=AIChampion' },
  { name: 'Kỳ Thủ Tinh Anh', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=CyberMaster' },
];

const PROFILE_TABS = ['info', 'avatar', 'security'] as const;
type ProfileTab = (typeof PROFILE_TABS)[number];

export default function ProfilePage() {
  const { user, updateUser } = useAuthStore();

  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl || '');
  const [email, setEmail] = useState(user?.email || '');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [activeTab, setActiveTab] = useState<ProfileTab>('info');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const tabRefs = useRef<Record<ProfileTab, HTMLButtonElement | null>>({
    info: null,
    avatar: null,
    security: null,
  });

  const handleTabKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, currentKey: ProfileTab) => {
    const idx = PROFILE_TABS.indexOf(currentKey);
    let nextTab: ProfileTab | null = null;
    if (e.key === 'ArrowRight') {
      nextTab = PROFILE_TABS[(idx + 1) % PROFILE_TABS.length];
    } else if (e.key === 'ArrowLeft') {
      nextTab = PROFILE_TABS[(idx - 1 + PROFILE_TABS.length) % PROFILE_TABS.length];
    } else if (e.key === 'Home') {
      nextTab = PROFILE_TABS[0];
    } else if (e.key === 'End') {
      nextTab = PROFILE_TABS[PROFILE_TABS.length - 1];
    }
    if (nextTab) {
      e.preventDefault();
      setActiveTab(nextTab);
      tabRefs.current[nextTab]?.focus();
    }
  };

  // Fetch recent matches
  const { data: recentGames = [] } = useQuery({
    queryKey: ['myGamesHistory'],
    queryFn: async () => {
      const res = await api.get('/games/history/me?limit=5');
      return res.data.data || [];
    },
  });

  const processFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setIsError(true);
      setMessage('Vui lòng chọn một tệp hình ảnh hợp lệ (PNG, JPG, WEBP, GIF)');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setIsError(true);
      setMessage('Dung lượng tệp ảnh không được vượt quá 10MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        // Crop & Resize to 256x256 square avatar using HTML5 Canvas
        const canvas = document.createElement('canvas');
        const size = 256;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Crop center
        const minDim = Math.min(img.width, img.height);
        const startX = (img.width - minDim) / 2;
        const startY = (img.height - minDim) / 2;

        ctx.drawImage(img, startX, startY, minDim, minDim, 0, 0, size, size);
        const optimizedDataUrl = canvas.toDataURL('image/jpeg', 0.88);
        setAvatarUrl(optimizedDataUrl);
        setIsError(false);
        setMessage('Đã chọn ảnh từ máy thành công! Nhấn "Lưu Cập Nhật Hồ Sơ" để áp dụng.');
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdating(true);
    setMessage('');
    setIsError(false);

    if (newPassword && newPassword !== confirmPassword) {
      setIsError(true);
      setMessage('Mật khẩu xác nhận không khớp');
      setIsUpdating(false);
      return;
    }

    try {
      const payload: any = {};
      if (displayName !== user?.displayName) payload.displayName = displayName;
      if (bio !== user?.bio) payload.bio = bio;
      if (avatarUrl !== user?.avatarUrl) payload.avatarUrl = avatarUrl;
      if (email && email !== user?.email) payload.email = email;

      if (newPassword) {
        if (user?.hasPassword && !currentPassword) {
          throw new Error('Vui lòng nhập mật khẩu hiện tại');
        }
        payload.currentPassword = currentPassword;
        payload.newPassword = newPassword;
      }

      const res = await api.patch('/users/me', payload);
      if (res.data.success) {
        updateUser(res.data.data);
        setMessage('Cập nhật hồ sơ kỳ thủ thành công!');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      }
    } catch (err: any) {
      setIsError(true);
      setMessage(
        err.response?.data?.message || err.message || 'Không thể cập nhật hồ sơ, vui lòng kiểm tra lại'
      );
    } finally {
      setIsUpdating(false);
    }
  };

  const currentDisplay = displayName || user?.displayName || user?.username || 'Kỳ Thủ';

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 flex-1 flex flex-col gap-8">
      {/* Hidden File Input */}
      <input
        id="profile-avatar-file"
        type="file"
        ref={fileInputRef}
        aria-label="Chọn tệp ảnh đại diện từ máy tính"
        accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
        onChange={(e) => {
          if (e.target.files?.[0]) processFile(e.target.files[0]);
        }}
        className="hidden"
      />

      {/* Profile Header Card */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 sm:p-8 shadow-card flex flex-wrap items-center justify-between gap-6 relative overflow-hidden">
        <div className="flex items-center gap-4 sm:gap-5 z-10 min-w-0">
          <div className="relative group shrink-0">
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-slate-900 border-2 border-white flex items-center justify-center font-extrabold text-3xl sm:text-4xl text-white shadow-md overflow-hidden">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={currentDisplay}
                  width={96}
                  height={96}
                  decoding="async"
                  className="w-full h-full object-cover"
                  onError={() => setAvatarUrl('')}
                />
              ) : (
                currentDisplay.slice(0, 1).toUpperCase()
              )}
            </div>
            <button
              type="button"
              onClick={() => setActiveTab('avatar')}
              className="group/cam absolute -bottom-2 -right-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 active:scale-[0.96] transition-transform"
              title="Đổi ảnh đại diện"
              aria-label="Đổi ảnh đại diện"
            >
              <span className="w-8 h-8 rounded-xl bg-sky-700 group-hover/cam:bg-sky-800 text-white shadow-sm border-2 border-white flex items-center justify-center transition-colors">
                <Camera className="w-3.5 h-3.5" />
              </span>
            </button>
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight break-words">
                {currentDisplay}
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase bg-sky-50 text-sky-700 border border-sky-200/80">
                {user?.role}
              </span>
            </div>
            <div className="text-xs text-slate-600 mt-0.5 font-mono font-medium">@{user?.username}</div>

            {/* Verification Status Badge */}
            <div className="flex flex-wrap items-center gap-2 mt-2">
              {user?.isEmailVerified ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/90">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Email đã xác minh</span>
                </span>
              ) : (
                <div className="inline-flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200/90">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                    <span>Chưa xác minh email</span>
                  </span>
                  <Link
                    to={`/verify-email?email=${encodeURIComponent(user?.email || '')}`}
                    className="text-xs font-bold text-sky-700 hover:text-sky-800 underline inline-flex items-center min-h-[44px] sm:min-h-0 px-1"
                  >
                    Xác minh ngay
                  </Link>
                </div>
              )}
            </div>

            {bio && (
              <p className="text-xs sm:text-sm text-slate-600 mt-2 max-w-md line-clamp-2 italic">
                "{bio}"
              </p>
            )}
          </div>
        </div>

        <div className="w-full sm:w-auto flex items-center justify-around sm:justify-start gap-6 pt-4 sm:pt-0 sm:pl-6 border-t sm:border-t-0 sm:border-l border-slate-200/80 z-10">
          <div className="text-center">
            <div className="text-xs font-semibold text-slate-500">
              Xếp hạng ELO
            </div>
            <div className="text-2xl sm:text-3xl font-mono tabular-nums font-black text-sky-700 mt-0.5">
              {user?.eloRating}
            </div>
          </div>
          <div className="w-px h-10 bg-slate-200" />
          <div className="text-center">
            <div className="text-xs font-semibold text-slate-500">
              Trạng thái
            </div>
            <div className="text-xs sm:text-sm font-bold text-emerald-700 mt-2 flex items-center gap-1.5 justify-center">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" aria-hidden="true" />
              <span>{user?.accountStatus}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Grid: Edit Tabs & Recent History */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Profile Tabs & Form */}
        <div className="lg:col-span-7 min-w-0 bg-white border border-slate-200/80 rounded-2xl p-6 shadow-card flex flex-col">
          {/* Navigation Tabs */}
          <div role="tablist" aria-label="Các mục hồ sơ cá nhân" className="flex items-center gap-2 overflow-x-auto border-b border-slate-200/80 pb-3 mb-6">
            <button
              ref={(el) => {
                tabRefs.current.info = el;
              }}
              id="tab-info"
              role="tab"
              aria-selected={activeTab === 'info'}
              aria-controls="panel-info"
              tabIndex={activeTab === 'info' ? 0 : -1}
              type="button"
              onClick={() => setActiveTab('info')}
              onKeyDown={(e) => handleTabKeyDown(e, 'info')}
              className={`px-3.5 py-2 min-h-[44px] whitespace-nowrap shrink-0 rounded-xl text-xs sm:text-sm font-bold transition-colors duration-150 flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
                activeTab === 'info'
                  ? 'bg-sky-50 text-sky-700 border border-sky-200'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
              }`}
            >
              <User className="w-4 h-4" />
              <span>Thông Tin Kỳ Thủ</span>
            </button>
            <button
              ref={(el) => {
                tabRefs.current.avatar = el;
              }}
              id="tab-avatar"
              role="tab"
              aria-selected={activeTab === 'avatar'}
              aria-controls="panel-avatar"
              tabIndex={activeTab === 'avatar' ? 0 : -1}
              type="button"
              onClick={() => setActiveTab('avatar')}
              onKeyDown={(e) => handleTabKeyDown(e, 'avatar')}
              className={`px-3.5 py-2 min-h-[44px] whitespace-nowrap shrink-0 rounded-xl text-xs sm:text-sm font-bold transition-colors duration-150 flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
                activeTab === 'avatar'
                  ? 'bg-sky-50 text-sky-700 border border-sky-200'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
              }`}
            >
              <ImageIcon className="w-4 h-4" />
              <span>Ảnh Đại Diện</span>
            </button>
            <button
              ref={(el) => {
                tabRefs.current.security = el;
              }}
              id="tab-security"
              role="tab"
              aria-selected={activeTab === 'security'}
              aria-controls="panel-security"
              tabIndex={activeTab === 'security' ? 0 : -1}
              type="button"
              onClick={() => setActiveTab('security')}
              onKeyDown={(e) => handleTabKeyDown(e, 'security')}
              className={`px-3.5 py-2 min-h-[44px] whitespace-nowrap shrink-0 rounded-xl text-xs sm:text-sm font-bold transition-colors duration-150 flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
                activeTab === 'security'
                  ? 'bg-sky-50 text-sky-700 border border-sky-200'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
              }`}
            >
              <Key className="w-4 h-4" />
              <span>Bảo Mật</span>
            </button>
          </div>

          {message && (
            <div
              role={isError ? 'alert' : 'status'}
              aria-live={isError ? 'assertive' : 'polite'}
              className={`mb-6 p-3.5 rounded-xl border text-xs sm:text-sm flex items-center gap-2.5 animate-in fade-in duration-150 ${
                isError
                  ? 'bg-rose-50 border-rose-200 text-rose-700'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-800'
              }`}
            >
              {isError ? (
                <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
              ) : (
                <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              )}
              <span>{message}</span>
            </div>
          )}

          <form onSubmit={handleUpdate} className="space-y-4 flex-1 flex flex-col justify-between">
            {/* Tab 1: General Info */}
            {activeTab === 'info' && (
              <div
                id="panel-info"
                role="tabpanel"
                aria-labelledby="tab-info"
                className="space-y-4 animate-in fade-in duration-150"
              >
                <div>
                  <label htmlFor="profile-display-name" className="block text-xs font-semibold text-slate-600 mb-1.5">
                    Tên hiển thị (Display Name)
                  </label>
                  <input
                    id="profile-display-name"
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    aria-describedby="profile-display-name-hint"
                    placeholder="Ví dụ: Đại Kiện Tướng"
                    maxLength={50}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200/90 rounded-xl text-slate-900 text-base sm:text-sm focus:outline-none focus:border-sky-500 focus:bg-white focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-1 transition-colors"
                  />
                  <p id="profile-display-name-hint" className="text-xs leading-relaxed text-slate-600 mt-1">
                    Tên hiển thị sẽ xuất hiện trong các phòng thi đấu cờ và bảng xếp hạng.
                  </p>
                </div>

                <div>
                  <label htmlFor="profile-bio" className="block text-xs font-semibold text-slate-600 mb-1.5">
                    Tiểu sử / Phong cách chơi (Bio)
                  </label>
                  <textarea
                    id="profile-bio"
                    rows={3}
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    aria-describedby="profile-bio-count"
                    placeholder="Chia sẻ đôi nét về bạn, sở thích khai cuộc hoặc phong cách cờ..."
                    maxLength={300}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200/90 rounded-xl text-slate-900 text-base sm:text-sm focus:outline-none focus:border-sky-500 focus:bg-white focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-1 transition-colors resize-none"
                  />
                  <div id="profile-bio-count" className="text-xs text-slate-600 font-mono tabular-nums font-medium text-right mt-1">
                    {bio.length}/300
                  </div>
                </div>

                <div>
                  <label htmlFor="profile-email" className="block text-xs font-semibold text-slate-600 mb-1.5">
                    Địa chỉ Email
                  </label>
                  <input
                    id="profile-email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    aria-describedby={email !== user?.email ? 'profile-email-warning' : undefined}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200/90 rounded-xl text-slate-900 text-base sm:text-sm focus:outline-none focus:border-sky-500 focus:bg-white focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-1 transition-colors"
                  />
                  {email !== user?.email && (
                    <p id="profile-email-warning" className="text-xs leading-relaxed text-amber-700 mt-1">
                      ⚠️ Lưu ý: Khi thay đổi email, bạn sẽ cần xác minh lại địa chỉ email mới.
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Tab 2: Avatar Selection & Upload */}
            {activeTab === 'avatar' && (
              <div
                id="panel-avatar"
                role="tabpanel"
                aria-labelledby="tab-avatar"
                className="space-y-5 animate-in fade-in duration-150"
              >
                {/* 1. Upload from Computer Box */}
                <div>
                  <p id="avatar-upload-heading" className="block text-xs font-semibold text-slate-700 mb-2">
                    Tải ảnh lên từ máy tính của bạn
                  </p>
                  <button
                    type="button"
                    aria-labelledby="avatar-upload-heading"
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragging(true);
                    }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDragging(false);
                      if (e.dataTransfer.files?.[0]) processFile(e.dataTransfer.files[0]);
                    }}
                    className={`w-full border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-colors duration-150 flex flex-col items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
                      isDragging
                        ? 'border-sky-500 bg-sky-50/70 scale-[0.99]'
                        : 'border-slate-200/90 bg-slate-50/50 hover:bg-slate-50 hover:border-sky-400'
                    }`}
                  >
                    <div className="w-12 h-12 rounded-xl bg-sky-100 text-sky-600 flex items-center justify-center shadow-subtle">
                      <UploadCloud className="w-6 h-6" />
                    </div>
                    <div>
                      <span className="text-xs sm:text-sm font-bold text-sky-700 hover:underline">
                        Nhấn để chọn ảnh
                      </span>{' '}
                      <span className="text-xs text-slate-500">hoặc kéo thả ảnh vào đây</span>
                    </div>
                    <p className="text-xs text-slate-600">
                      Hỗ trợ PNG, JPG, JPEG, WEBP, GIF (Tự động căn chỉnh & tối ưu hóa ảnh đại diện)
                    </p>
                  </button>

                  {avatarUrl && (
                    <div className="flex flex-wrap items-center justify-between gap-2 mt-2.5 px-1">
                      <span className="text-xs text-slate-500 flex items-center gap-1.5">
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Đã có ảnh đại diện được chọn</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setAvatarUrl('');
                          setMessage('Đã xóa ảnh đại diện. Nhấn "Lưu Cập Nhật Hồ Sơ" để áp dụng.');
                        }}
                        className="text-xs font-semibold text-rose-600 hover:text-rose-700 flex items-center gap-1 min-h-[44px] sm:min-h-[36px] px-2.5 py-1.5 rounded-lg hover:bg-rose-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Xóa ảnh / Dùng mặc định</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* 2. Preset Avatars */}
                <fieldset className="pt-3 border-t border-slate-100">
                  <legend className="block text-xs font-semibold text-slate-700 mb-2">
                    Hoặc chọn avatar cờ vua sẵn có
                  </legend>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {PRESET_AVATARS.map((p) => {
                      const isSelected = avatarUrl === p.url;
                      return (
                        <button
                          key={p.url}
                          type="button"
                          aria-pressed={isSelected}
                          onClick={() => {
                            setAvatarUrl(p.url);
                            setMessage(`Đã chọn avatar "${p.name}". Nhấn "Lưu Cập Nhật Hồ Sơ" để áp dụng.`);
                          }}
                          className={`p-2 rounded-xl border text-center transition-colors duration-150 flex flex-col items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
                            isSelected
                              ? 'border-sky-500 bg-sky-50 shadow-sm ring-2 ring-sky-500/20'
                              : 'border-slate-200/80 hover:border-slate-300 hover:bg-slate-50'
                          }`}
                        >
                          <img
                            src={p.url}
                            alt={p.name}
                            width={48}
                            height={48}
                            loading="lazy"
                            decoding="async"
                            className="w-12 h-12 rounded-xl bg-slate-100 object-cover"
                          />
                          <span className="text-xs font-semibold text-slate-700 truncate w-full">
                            {p.name}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </fieldset>
              </div>
            )}

            {/* Tab 3: Security & Password */}
            {activeTab === 'security' && (
              <div
                id="panel-security"
                role="tabpanel"
                aria-labelledby="tab-security"
                className="space-y-4 animate-in fade-in duration-150"
              >
                {!user?.hasPassword && (
                  <div className="p-3.5 rounded-xl bg-sky-50 border border-sky-200 text-sky-800 text-xs">
                    Tài khoản của bạn được liên kết với Google. Bạn có thể thiết lập mật khẩu bên dưới để có thể đăng nhập bằng cả Google và mật khẩu riêng.
                  </div>
                )}

                {user?.hasPassword && (
                  <div>
                    <label htmlFor="profile-current-password" className="block text-xs font-semibold text-slate-600 mb-1.5">
                      Mật khẩu hiện tại
                    </label>
                    <input
                      id="profile-current-password"
                      type="password"
                      autoComplete="current-password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Nhập mật khẩu đang dùng..."
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200/90 rounded-xl text-slate-900 text-base sm:text-sm focus:outline-none focus:border-sky-500 focus:bg-white focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-1 transition-colors"
                    />
                  </div>
                )}

                <div>
                  <label htmlFor="profile-new-password" className="block text-xs font-semibold text-slate-600 mb-1.5">
                    {user?.hasPassword ? 'Mật khẩu mới' : 'Thiết lập mật khẩu'}
                  </label>
                  <input
                    id="profile-new-password"
                    type="password"
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Tối thiểu 6 ký tự..."
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200/90 rounded-xl text-slate-900 text-base sm:text-sm focus:outline-none focus:border-sky-500 focus:bg-white focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-1 transition-colors"
                  />
                </div>

                <div>
                  <label htmlFor="profile-confirm-password" className="block text-xs font-semibold text-slate-600 mb-1.5">
                    Xác nhận mật khẩu mới
                  </label>
                  <input
                    id="profile-confirm-password"
                    type="password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Nhập lại mật khẩu mới..."
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200/90 rounded-xl text-slate-900 text-base sm:text-sm focus:outline-none focus:border-sky-500 focus:bg-white focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-1 transition-colors"
                  />
                </div>
              </div>
            )}

            <div className="pt-4 border-t border-slate-100 mt-6">
              <button
                type="submit"
                disabled={isUpdating}
                className="w-full py-3 bg-slate-900 hover:bg-slate-800 active:scale-[0.98] disabled:opacity-50 font-bold text-white rounded-xl text-sm shadow-sm transition-colors duration-150 flex items-center justify-center gap-2"
              >
                {isUpdating ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Đang lưu thay đổi...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Lưu Cập Nhật Hồ Sơ</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Right Column: Recent Matches */}
        <div className="lg:col-span-5 min-w-0 bg-white border border-slate-200/80 rounded-2xl p-6 shadow-card flex flex-col justify-between">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
              <Swords className="w-5 h-5 text-sky-600" />
              <span>Ván Đấu Gần Đây</span>
            </h2>

            {recentGames.length === 0 ? (
              <div className="py-12 text-center text-slate-500 flex flex-col items-center">
                <Swords className="w-10 h-10 text-slate-400 mb-2" />
                <p className="text-xs sm:text-sm text-slate-600">Bạn chưa tham gia trận đấu nào.</p>
                <Link
                  to="/lobby"
                  className="mt-3 text-xs font-bold text-sky-700 hover:text-sky-800"
                >
                  Vào sảnh chờ để bắt đầu ván đầu tiên
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {recentGames.map((g: any) => {
                  const isWhite = g.whitePlayerId === user?.id;
                  const opponentName = isWhite ? g.blackPlayerName : g.whitePlayerName;
                  const won =
                    (g.result === 'WHITE_WON' && isWhite) ||
                    (g.result === 'BLACK_WON' && !isWhite);
                  const isDraw = g.result === 'DRAW';

                  return (
                    <div
                      key={g.id}
                      className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-3 min-w-0 text-xs"
                    >
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-800 truncate">
                          Đối đầu:{' '}
                          <span className="text-slate-900 font-bold">{opponentName || 'Máy AI'}</span>
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5 truncate">
                          {isWhite ? 'Quân Trắng' : 'Quân Đen'} • {g.gameMode}
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span
                          className={`font-bold px-2 py-0.5 rounded text-xs ${
                            won
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : isDraw
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                        >
                          {won ? 'Thắng' : isDraw ? 'Hòa' : 'Thua'}
                        </span>
                        <div className="text-xs text-slate-600 mt-1 font-semibold">
                          {g.terminationReason || 'Hoàn tất'}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-slate-100 mt-4 text-center">
            <Link
              to="/history"
              className="text-xs text-sky-700 hover:text-sky-800 font-semibold inline-flex items-center justify-center min-h-[44px] sm:min-h-0 px-2 transition-colors"
            >
              <span>Xem toàn bộ lịch sử đấu & phân tích ván cờ</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
