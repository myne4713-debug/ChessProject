import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';
import { LeaderboardEntry } from '@online-chess/shared';
import { Trophy, ChevronLeft, ChevronRight } from 'lucide-react';

export default function LeaderboardPage() {
  const [page, setPage] = useState(1);
  const limit = 20;

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['leaderboard', page],
    queryFn: async () => {
      const res = await api.get(`/leaderboard?page=${page}&limit=${limit}`);
      return res.data.data;
    },
  });

  const entries: LeaderboardEntry[] = data?.data || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / limit) || 1;

  const getRankBadge = (rank: number) => {
    if (rank === 1) {
      return (
        <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-gradient-to-b from-amber-300 to-yellow-500 text-slate-950 font-extrabold text-xs shadow-sm">
          🥇 1
        </span>
      );
    }
    if (rank === 2) {
      return (
        <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-gradient-to-b from-slate-200 to-slate-400 text-slate-900 font-extrabold text-xs shadow-sm">
          🥈 2
        </span>
      );
    }
    if (rank === 3) {
      return (
        <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-gradient-to-b from-amber-600 to-amber-800 text-white font-extrabold text-xs shadow-sm">
          🥉 3
        </span>
      );
    }
    return (
      <span className="font-mono tabular-nums font-bold text-slate-500 text-xs px-2 py-1">
        #{rank}
      </span>
    );
  };

  const getTitleBadge = (elo: number) => {
    if (elo >= 2200) {
      return (
        <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-purple-50 text-purple-700 border border-purple-200">
          Đại Kiện Tướng
        </span>
      );
    }
    if (elo >= 1800) {
      return (
        <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-blue-50 text-blue-700 border border-blue-200">
          Kiện Tướng
        </span>
      );
    }
    if (elo >= 1500) {
      return (
        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
          Cao Thủ
        </span>
      );
    }
    return (
      <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
        Kỳ Thủ
      </span>
    );
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 flex-1 flex flex-col gap-6">
      {/* Leaderboard Header */}
      <div className="pb-5 border-b border-slate-200/80">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
          <Trophy className="w-7 h-7 text-amber-600 shrink-0" aria-hidden="true" />
          <span>Bảng Xếp Hạng Kỳ Thủ</span>
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1.5 max-w-2xl leading-relaxed">
          Điểm hệ số ELO được tính toán và đồng bộ tự động sau mỗi ván đấu theo tiêu chuẩn quốc tế FIDE.
        </p>
      </div>

      {/* Leaderboard Table Card */}
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-card overflow-hidden flex-1 flex flex-col">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-slate-50/80 text-slate-600 font-semibold text-xs border-b border-slate-200/80">
              <tr>
                <th className="px-6 py-3.5 w-24">Thứ Hạng</th>
                <th className="px-6 py-3.5">Kỳ Thủ</th>
                <th className="px-6 py-3.5 text-right w-36">Hệ Số ELO</th>
                <th className="px-6 py-3.5 text-center w-36">Danh Hiệu</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={4} className="text-center py-16 text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="w-6 h-6 border-2 border-sky-700 border-t-transparent rounded-full animate-spin" />
                      <span className="text-xs">Đang tải dữ liệu xếp hạng...</span>
                    </div>
                  </td>
                </tr>
              ) : isError ? (
                <tr>
                  <td colSpan={4} className="text-center py-16 text-slate-600">
                    <div role="alert" className="flex flex-col items-center justify-center gap-3">
                      <span className="text-sm font-semibold text-slate-800">
                        Không thể tải bảng xếp hạng. Vui lòng thử lại.
                      </span>
                      <button
                        type="button"
                        onClick={() => refetch()}
                        className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                      >
                        Thử lại
                      </button>
                    </div>
                  </td>
                </tr>
              ) : entries.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-16 text-slate-500">
                    Chưa có kỳ thủ nào trong bảng xếp hạng
                  </td>
                </tr>
              ) : (
                entries.map((entry) => (
                  <tr
                    key={entry.userId}
                    className="hover:bg-slate-50/80 transition-colors duration-150"
                  >
                    <td className="px-6 py-4">{getRankBadge(entry.rank)}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-slate-900 text-white font-bold text-xs flex items-center justify-center shadow-sm">
                          {entry.username.slice(0, 1).toUpperCase()}
                        </div>
                        <div>
                          <span className="font-bold text-slate-900 block leading-tight">
                            {entry.username}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="font-mono tabular-nums font-extrabold text-sky-700 text-sm">
                        {entry.eloRating}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">{getTitleBadge(entry.eloRating)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination footer */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between text-xs sm:text-sm text-slate-600">
            <div>
              Trang <span className="font-mono tabular-nums font-bold">{page}</span> /{' '}
              <span className="font-mono tabular-nums font-bold">{totalPages}</span> (Tổng số {total}{' '}
              kỳ thủ)
            </div>

            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                aria-label="Trang trước"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none text-slate-700 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                aria-label="Trang sau"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none text-slate-700 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
