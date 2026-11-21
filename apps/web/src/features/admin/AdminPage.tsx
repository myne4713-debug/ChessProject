import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import { ShieldAlert, Users, Search, Ban, CheckCircle, Cpu, Clock, AlertCircle, X } from 'lucide-react';

export default function AdminPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [actionFeedback, setActionFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Fetch admin stats
  const { data: stats } = useQuery({
    queryKey: ['adminStats'],
    queryFn: async () => {
      const res = await api.get('/admin/stats');
      return res.data.data;
    },
  });

  // Fetch user list
  const { data: usersData, isLoading, isError: isUsersError, refetch: refetchUsers } = useQuery({
    queryKey: ['adminUsers', search],
    queryFn: async () => {
      const res = await api.get(`/admin/users?search=${encodeURIComponent(search)}`);
      return res.data;
    },
  });

  // Toggle user status mutation
  const statusMutation = useMutation({
    mutationFn: async ({ userId, newStatus }: { userId: string; newStatus: string }) => {
      const res = await api.patch(`/admin/users/${userId}/status`, { status: newStatus });
      return res.data;
    },
    onMutate: () => {
      setActionFeedback(null);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['adminUsers'] });
      setActionFeedback({
        type: 'success',
        message:
          variables.newStatus === 'SUSPENDED'
            ? 'Đã khóa tài khoản người dùng.'
            : 'Đã kích hoạt lại tài khoản người dùng.',
      });
    },
    onError: (err: any) => {
      setActionFeedback({
        type: 'error',
        message:
          err?.response?.data?.message ||
          'Không thể cập nhật trạng thái tài khoản. Thử lại sau.',
      });
    },
  });

  const users = usersData?.data || [];

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 flex-1 flex flex-col gap-8">
      {/* Admin Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-slate-200/80 gap-4">
        <div>
          <div className="flex items-center gap-2 text-amber-700 font-semibold text-xs mb-1">
            <ShieldAlert className="w-4 h-4 text-amber-600" />
            <span>Bảng điều khiển quản trị hệ thống</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Quản Lý Người Dùng & Hạ Tầng Máy Chủ
          </h1>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-card flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-sky-50 text-sky-600 border border-sky-100 flex items-center justify-center flex-shrink-0">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-600">
              Tổng kỳ thủ đăng ký
            </div>
            <div className="text-2xl font-mono tabular-nums font-black text-slate-900 mt-0.5">
              {stats?.totalUsers || 0}
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-card flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center flex-shrink-0">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-600">
              Thời gian máy chủ
            </div>
            <div className="text-2xl font-mono tabular-nums font-black text-slate-900 mt-0.5">
              {stats ? `${Math.round(stats.activeServerUptimeSec / 60)} phút` : '...'}
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-card flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center flex-shrink-0">
            <Cpu className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-600">
              Bộ nhớ sử dụng (RAM)
            </div>
            <div className="text-2xl font-mono tabular-nums font-black text-slate-900 mt-0.5">
              {stats?.memoryUsageMb || 0} MB
            </div>
          </div>
        </div>
      </div>

      {/* User Management Section */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-card flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-sky-600" />
            <h2 className="text-base sm:text-lg font-bold text-slate-900">
              Danh Sách Tài Khoản ({users.length})
            </h2>
          </div>

          <div className="relative w-full sm:w-72">
            <label htmlFor="admin-user-search" className="sr-only">
              Tìm kiếm tài khoản theo username hoặc email
            </label>
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
            <input
              id="admin-user-search"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm kiếm username, email..."
              className="w-full min-h-[44px] pl-9 pr-4 py-2 bg-slate-50 border border-slate-200/90 rounded-xl text-slate-900 text-base sm:text-sm placeholder-slate-500 focus:outline-none focus:border-sky-500 focus:bg-white focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-1 transition-colors"
            />
          </div>
        </div>

        {actionFeedback && (
          <div
            role={actionFeedback.type === 'error' ? 'alert' : 'status'}
            aria-live="polite"
            className={`px-3.5 py-2.5 rounded-xl border text-xs sm:text-sm font-medium flex items-center justify-between gap-3 animate-in fade-in duration-150 ${
              actionFeedback.type === 'error'
                ? 'bg-rose-50 border-rose-200 text-rose-700'
                : 'bg-emerald-50 border-emerald-200 text-emerald-800'
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              {actionFeedback.type === 'error' ? (
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" aria-hidden="true" />
              ) : (
                <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600" aria-hidden="true" />
              )}
              <span>{actionFeedback.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setActionFeedback(null)}
              aria-label="Đóng thông báo"
              className="min-h-[44px] min-w-[44px] sm:min-h-[32px] sm:min-w-[32px] shrink-0 flex items-center justify-center rounded-lg hover:bg-black/5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* User Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-slate-50/80 text-slate-600 font-semibold text-xs border-b border-slate-200/80">
              <tr>
                <th className="px-4 py-3.5">Username</th>
                <th className="px-4 py-3.5">Email</th>
                <th className="px-4 py-3.5">Vai Trò</th>
                <th className="px-4 py-3.5">Hệ Số ELO</th>
                <th className="px-4 py-3.5">Trạng Thái</th>
                <th className="px-4 py-3.5 text-right">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-500">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-5 h-5 border-2 border-sky-600 border-t-transparent rounded-full animate-spin" />
                      <span>Đang tải danh sách người dùng...</span>
                    </div>
                  </td>
                </tr>
              ) : isUsersError ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-600">
                    <div role="alert" className="flex flex-col items-center gap-3">
                      <span className="font-semibold text-slate-800">
                        Không thể tải danh sách tài khoản người dùng.
                      </span>
                      <button
                        type="button"
                        onClick={() => refetchUsers()}
                        className="px-4 py-2 min-h-[44px] bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                      >
                        Thử lại
                      </button>
                    </div>
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-500">
                    Không tìm thấy tài khoản người dùng phù hợp.
                  </td>
                </tr>
              ) : (
                users.map((u: any) => {
                  const isSuspended = u.accountStatus === 'SUSPENDED';
                  const isMutatingThisUser =
                    statusMutation.isPending && statusMutation.variables?.userId === u.id;

                  return (
                    <tr key={u.id} className="hover:bg-slate-50/80 transition-colors duration-150">
                      <td className="px-4 py-3.5 font-bold text-slate-900">{u.username}</td>
                      <td className="px-4 py-3.5 text-slate-600 font-medium">{u.email}</td>
                      <td className="px-4 py-3.5">
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${
                            u.role === 'ADMIN'
                              ? 'bg-amber-50 text-amber-800 border border-amber-200'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {u.role}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 font-mono tabular-nums text-sky-700 font-bold">
                        {u.eloRating}
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                            isSuspended
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          }`}
                        >
                          {u.accountStatus}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        {u.role !== 'ADMIN' && (
                          <button
                            type="button"
                            disabled={isMutatingThisUser}
                            onClick={() =>
                              statusMutation.mutate({
                                userId: u.id,
                                newStatus: isSuspended ? 'ACTIVE' : 'SUSPENDED',
                              })
                            }
                            className={`px-3 py-2 sm:py-1.5 min-h-[44px] sm:min-h-[36px] rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors shadow-subtle disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
                              isSuspended
                                ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200'
                                : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200'
                            }`}
                          >
                            {isSuspended ? (
                              <>
                                <CheckCircle className="w-3.5 h-3.5" />
                                <span>{isMutatingThisUser ? 'Đang xử lý...' : 'Kích hoạt lại'}</span>
                              </>
                            ) : (
                              <>
                                <Ban className="w-3.5 h-3.5" />
                                <span>{isMutatingThisUser ? 'Đang xử lý...' : 'Khóa tài khoản'}</span>
                              </>
                            )}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
