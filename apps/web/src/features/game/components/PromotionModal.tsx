import React from 'react';
import { Crown, Shield, Award, Zap } from 'lucide-react';

interface PromotionModalProps {
  isOpen: boolean;
  color: 'w' | 'b';
  onSelect: (piece: 'q' | 'r' | 'b' | 'n') => void;
  onCancel: () => void;
}

export const PromotionModal: React.FC<PromotionModalProps> = ({
  isOpen,
  color,
  onSelect,
  onCancel,
}) => {
  if (!isOpen) return null;

  const options: Array<{
    piece: 'q' | 'r' | 'b' | 'n';
    name: string;
    sub: string;
    icon: React.ReactNode;
  }> = [
    {
      piece: 'q',
      name: 'Hậu (Queen)',
      sub: 'Nước đi mạnh mẽ nhất',
      icon: <Crown className="w-6 h-6 text-sky-400" />,
    },
    {
      piece: 'r',
      name: 'Xe (Rook)',
      sub: 'Kiểm soát hàng & cột',
      icon: <Shield className="w-6 h-6 text-slate-300" />,
    },
    {
      piece: 'b',
      name: 'Tượng (Bishop)',
      sub: 'Tấn công đường chéo',
      icon: <Award className="w-6 h-6 text-amber-300" />,
    },
    {
      piece: 'n',
      name: 'Mã (Knight)',
      sub: 'Nhảy vượt chướng ngại',
      icon: <Zap className="w-6 h-6 text-emerald-400" />,
    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-labelledby="promotion-title"
    >
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl p-6 max-w-sm w-full shadow-2xl text-slate-100">
        <div className="text-center mb-5">
          <h3 id="promotion-title" className="text-lg font-bold text-white tracking-tight">
            Phong cấp Tốt ({color === 'w' ? 'Trắng' : 'Đen'})
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Chọn quân cờ bạn muốn chuyển đổi cho quân Tốt
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-5">
          {options.map((opt) => (
            <button
              key={opt.piece}
              type="button"
              onClick={() => onSelect(opt.piece)}
              className="flex flex-col items-center justify-center p-4 rounded-xl bg-slate-800/90 hover:bg-slate-700/90 border border-slate-700 hover:border-sky-500/60 active:scale-[0.98] transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 group"
              aria-label={`Phong cấp thành ${opt.name}`}
            >
              <div className="p-2.5 rounded-lg bg-slate-900/60 group-hover:scale-110 transition-transform duration-150 mb-2">
                {opt.icon}
              </div>
              <span className="text-sm font-semibold text-slate-200 group-hover:text-white">
                {opt.name.split(' ')[0]}
              </span>
              <span className="text-[11px] text-slate-400 mt-0.5 text-center">
                {opt.sub}
              </span>
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={onCancel}
          className="w-full py-2.5 px-4 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 active:scale-[0.98] transition-all duration-150"
        >
          Hủy bỏ nước đi
        </button>
      </div>
    </div>
  );
};
