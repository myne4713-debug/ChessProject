import React from 'react';
import { PieceSvg } from '../../../components/chess/PieceSvg';
import { useDialogFocusTrap } from '../../../hooks/useDialogFocusTrap';

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
  const dialogRef = useDialogFocusTrap<HTMLDivElement>({
    isOpen,
    onClose: onCancel,
  });

  if (!isOpen) return null;

  const options: Array<{
    piece: 'q' | 'r' | 'b' | 'n';
    name: string;
    sub: string;
  }> = [
    {
      piece: 'q',
      name: 'Hậu (Queen)',
      sub: 'Nước đi mạnh mẽ nhất',
    },
    {
      piece: 'r',
      name: 'Xe (Rook)',
      sub: 'Kiểm soát hàng & cột',
    },
    {
      piece: 'b',
      name: 'Tượng (Bishop)',
      sub: 'Tấn công đường chéo',
    },
    {
      piece: 'n',
      name: 'Mã (Knight)',
      sub: 'Nhảy vượt chướng ngại',
    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-sm animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="promotion-title"
    >
      <div
        ref={dialogRef}
        className="bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-7 max-w-sm w-full shadow-modal text-slate-900 animate-in zoom-in-95 duration-150"
      >
        <div className="text-center mb-5">
          <h3 id="promotion-title" className="text-xl font-extrabold text-slate-900 tracking-tight">
            Phong Cấp Tốt ({color === 'w' ? 'Quân Trắng' : 'Quân Đen'})
          </h3>
          <p className="text-xs text-slate-600 mt-1 font-medium">
            Chọn quân cờ bạn muốn chuyển đổi cho quân Tốt
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-5">
          {options.map((opt) => (
            <button
              key={opt.piece}
              type="button"
              onClick={() => onSelect(opt.piece)}
              className="flex flex-col items-center justify-center p-3.5 rounded-xl bg-slate-50 hover:bg-sky-50/70 border border-slate-200/90 hover:border-sky-300 active:scale-[0.98] transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 group shadow-subtle"
              aria-label={`Phong cấp thành ${opt.name}`}
            >
              <div className="w-12 h-12 rounded-xl bg-white border border-slate-200/80 flex items-center justify-center group-hover:scale-105 transition-transform duration-150 mb-2 shadow-xs">
                <PieceSvg type={opt.piece} color={color} className="w-8 h-8 drop-shadow-xs" />
              </div>
              <span className="text-sm font-bold text-slate-900 group-hover:text-sky-700 transition-colors">
                {opt.name.split(' ')[0]}
              </span>
              <span className="text-[11px] text-slate-600 mt-0.5 text-center font-medium">
                {opt.sub}
              </span>
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={onCancel}
          className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 active:scale-[0.98] transition-all duration-150"
        >
          Hủy bỏ nước đi
        </button>
      </div>
    </div>
  );
};
