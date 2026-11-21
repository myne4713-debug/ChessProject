import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { registerSchema, RegisterInput } from '@online-chess/shared';
import { api } from '../../services/api';
import { Lock, User, Mail, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { PieceSvg } from '../../components/chess/PieceSvg';
import GoogleLoginButton from '../../components/auth/GoogleLoginButton';

export default function RegisterPage() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (data: RegisterInput) => {
    setIsLoading(true);
    setErrorMessage('');
    try {
      const res = await api.post('/auth/register', data);
      if (res.data.success) {
        navigate(`/verify-email?email=${encodeURIComponent(data.email)}`);
      }
    } catch (err: any) {
      setErrorMessage(
        err.response?.data?.message || 'Đăng ký không thành công, vui lòng thử lại.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center p-4 py-12">
      <div className="w-full max-w-md bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-8 shadow-card relative">
        <div className="flex items-center gap-3.5 mb-6">
          <div className="w-11 h-11 shrink-0 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-center text-white shadow-sm">
            <PieceSvg type="k" color="w" className="w-6 h-6 drop-shadow-sm" />
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              Đăng ký tài khoản
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Gia nhập cộng đồng kỳ thủ và bắt đầu thi đấu tính điểm Elo
            </p>
          </div>
        </div>

        {errorMessage && (
          <div
            role="alert"
            className="mb-5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs sm:text-sm flex items-center gap-2.5 animate-in fade-in duration-150"
          >
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Google One-Click Login */}
        <div className="mb-5">
          <GoogleLoginButton text="Đăng ký nhanh bằng Google" />
          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200" />
            </div>
            <div className="relative flex justify-center text-xs font-semibold text-slate-600">
              <span className="bg-white px-3">Hoặc điền biểu mẫu dưới đây</span>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label htmlFor="register-username" className="block text-xs font-semibold text-slate-700 mb-1.5">
              Tên kỳ thủ (Tên đăng nhập)
            </label>
            <div className="relative">
              <User className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
              <input
                {...register('username')}
                id="register-username"
                type="text"
                autoComplete="username"
                aria-invalid={!!errors.username}
                aria-describedby={errors.username ? 'register-username-error' : undefined}
                placeholder="Ví dụ: grandmaster_vn"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-500 focus:outline-none focus:border-slate-800 focus:bg-white focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-1 text-base sm:text-sm transition-colors"
              />
            </div>
            {errors.username && (
              <p id="register-username-error" role="alert" className="text-xs text-rose-600 mt-1">
                {errors.username.message}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="register-email" className="block text-xs font-semibold text-slate-700 mb-1.5">
              Địa chỉ email
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
              <input
                {...register('email')}
                id="register-email"
                type="email"
                autoComplete="email"
                aria-invalid={!!errors.email}
                aria-describedby={errors.email ? 'register-email-error' : undefined}
                placeholder="tenban@domain.com"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-500 focus:outline-none focus:border-slate-800 focus:bg-white focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-1 text-base sm:text-sm transition-colors"
              />
            </div>
            {errors.email && (
              <p id="register-email-error" role="alert" className="text-xs text-rose-600 mt-1">
                {errors.email.message}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="register-password" className="block text-xs font-semibold text-slate-700 mb-1.5">
              Mật khẩu
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
              <input
                {...register('password')}
                id="register-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                aria-invalid={!!errors.password}
                aria-describedby={errors.password ? 'register-password-error' : undefined}
                placeholder="Tối thiểu 6 ký tự"
                className="w-full pl-10 pr-12 py-2.5 min-h-[44px] bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-500 focus:outline-none focus:border-slate-800 focus:bg-white focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-1 text-base sm:text-sm transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                className="absolute right-0.5 top-1/2 -translate-y-1/2 min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-500 hover:text-slate-700 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.password && (
              <p id="register-password-error" role="alert" className="text-xs text-rose-600 mt-1">
                {errors.password.message}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full mt-2 py-3 bg-slate-900 hover:bg-slate-800 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none font-bold text-white rounded-xl shadow-sm transition-[background-color,opacity,transform] duration-150 ease-out flex items-center justify-center gap-2 text-sm focus-visible:ring-2 focus-visible:ring-slate-900"
          >
            {isLoading ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <span>Tạo tài khoản</span>
            )}
          </button>
        </form>

        <div className="mt-6 pt-5 border-t border-slate-100 text-center text-xs sm:text-sm text-slate-500">
          <span>Đã có tài khoản? </span>
          <Link
            to="/login"
            className="font-bold text-slate-900 hover:text-sky-700 transition-colors inline-flex items-center min-h-[44px] sm:min-h-0"
          >
            Đăng nhập ngay
          </Link>
        </div>
      </div>
    </div>
  );
}
