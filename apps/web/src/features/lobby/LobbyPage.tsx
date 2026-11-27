import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';
import { getSocket } from '../../services/socket';
import { useAuthStore } from '../../stores/authStore';
import { useDialogFocusTrap } from '../../hooks/useDialogFocusTrap';
import { notifyDesktop } from '../../lib/desktop';
import { RoomData, TIME_CONTROLS, SOCKET_EVENTS } from '@online-chess/shared';
import {
  Plus,
  Swords,
  Bot,
  Hash,
  Clock,
  Users,
  RefreshCw,
  X,
  Search,
  AlertCircle,
} from 'lucide-react';

const isValidTimeKey = (val: string | null): val is keyof typeof TIME_CONTROLS =>
  Boolean(val && val in TIME_CONTROLS);

export default function LobbyPage() {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuthStore();
  const socket = getSocket();

  const [searchParams] = useSearchParams();
  const urlJoinCode = searchParams.get('join') || '';
  const urlTimeParam = searchParams.get('time');

  // Create room modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [roomName, setRoomName] = useState('');
  const [visibility, setVisibility] = useState<'PUBLIC' | 'PRIVATE'>('PUBLIC');
  const [colorPref, setColorPref] = useState<'white' | 'black' | 'random'>('random');
  const [selectedTimeKey, setSelectedTimeKey] = useState<keyof typeof TIME_CONTROLS>(() =>
    isValidTimeKey(urlTimeParam) ? urlTimeParam : 'BLITZ_5'
  );
  const roomNameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isValidTimeKey(urlTimeParam)) {
      setSelectedTimeKey(urlTimeParam);
    }
  }, [urlTimeParam]);

  const createModalRef = useDialogFocusTrap<HTMLDivElement>({
    isOpen: showCreateModal,
    onClose: () => {
      setCreateRoomError('');
      setShowCreateModal(false);
    },
    initialFocusRef: roomNameInputRef,
  });

  // Join code & feedback states
  const [joinCode, setJoinCode] = useState(urlJoinCode);
  const [joinError, setJoinError] = useState('');
  const [createRoomError, setCreateRoomError] = useState('');
  const [lobbyNotice, setLobbyNotice] = useState('');

  // Submission guards
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [isJoiningByCode, setIsJoiningByCode] = useState(false);
  const [joiningRoomId, setJoiningRoomId] = useState<string | null>(null);

  // Matchmaking state
  const [isSearchingMatch, setIsSearchingMatch] = useState(false);
  const [searchTimer, setSearchTimer] = useState(0);

  // Search/Filter rooms
  const [filterQuery, setFilterQuery] = useState('');

  // Fetch public rooms
  const {
    data: rooms = [],
    isLoading: isLoadingRooms,
    isError: isRoomsError,
    refetch: refetchRooms,
    isFetching: isFetchingRooms,
  } = useQuery({
    queryKey: ['publicRooms'],
    queryFn: async () => {
      const res = await api.get('/rooms');
      return (res.data.data as RoomData[]) || [];
    },
    refetchInterval: 4000,
  });

  // Socket listeners for matchmaking and room events
  useEffect(() => {
    const handleMatchFound = (data: { gameId: string }) => {
      setIsSearchingMatch(false);
      notifyDesktop({
        title: 'Đã tìm thấy đối thủ!',
        body: 'Ván cờ của bạn đã sẵn sàng.',
        route: `/game/${data.gameId}`,
      });
      navigate(`/game/${data.gameId}`);
    };

    socket.on(SOCKET_EVENTS.MATCH_FOUND, handleMatchFound);

    return () => {
      socket.off(SOCKET_EVENTS.MATCH_FOUND, handleMatchFound);
    };
  }, [socket, navigate]);

  // Matchmaking timer
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isSearchingMatch) {
      interval = setInterval(() => {
        setSearchTimer((prev) => prev + 1);
      }, 1000);
    } else {
      setSearchTimer(0);
    }
    return () => clearInterval(interval);
  }, [isSearchingMatch]);

  const handleStartMatchmaking = () => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    const tc = TIME_CONTROLS[selectedTimeKey];
    setIsSearchingMatch(true);
    socket.emit(SOCKET_EVENTS.MATCHMAKING_JOIN, {
      initialTimeMs: tc.initialTimeMs,
      incrementMs: tc.incrementMs,
    });
  };

  const handleCancelMatchmaking = () => {
    setIsSearchingMatch(false);
    socket.emit(SOCKET_EVENTS.MATCHMAKING_CANCEL);
  };

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isCreatingRoom) return;
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    setCreateRoomError('');
    setIsCreatingRoom(true);
    try {
      const tc = TIME_CONTROLS[selectedTimeKey];
      const res = await api.post('/rooms', {
        name: roomName.trim() || (user?.username ? `Phòng của ${user.username}` : 'Phòng thi đấu cờ vua'),
        visibility,
        colorPreference: colorPref,
        initialTimeMs: tc.initialTimeMs,
        incrementMs: tc.incrementMs,
      });

      if (res.data.success && res.data.data) {
        setShowCreateModal(false);
        const newRoom: RoomData = res.data.data;
        socket.emit(SOCKET_EVENTS.JOIN_ROOM, { roomId: newRoom.id });
        if (newRoom.gameId) {
          navigate(`/game/${newRoom.gameId}`);
        } else {
          navigate(`/game/waiting?roomId=${newRoom.id}&code=${newRoom.roomCode}`);
        }
      }
    } catch (err: any) {
      setCreateRoomError(
        err.response?.data?.message ||
          'Không thể tạo phòng đấu lúc này. Kiểm tra kết nối và thử lại.'
      );
    } finally {
      setIsCreatingRoom(false);
    }
  };

  const handleJoinByCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isJoiningByCode) return;
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    if (!joinCode.trim()) return;

    setJoinError('');
    setIsJoiningByCode(true);
    try {
      const targetCode = joinCode.trim().toUpperCase();
      const res = await api.post(`/rooms/${targetCode}/join`, {});
      if (res.data.success && res.data.data) {
        const { gameId, room } = res.data.data;
        socket.emit(SOCKET_EVENTS.JOIN_ROOM, { roomCode: targetCode, roomId: room?.id });
        if (gameId) {
          navigate(`/game/${gameId}`);
        }
      }
    } catch (err: any) {
      setJoinError(err.response?.data?.message || 'Mã phòng không tồn tại hoặc phòng đã đầy');
    } finally {
      setIsJoiningByCode(false);
    }
  };

  const handleJoinDirect = async (roomId: string) => {
    if (joiningRoomId) return;
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    setLobbyNotice('');
    setJoiningRoomId(roomId);
    try {
      const res = await api.post(`/rooms/${roomId}/join`, {});
      if (res.data.success && res.data.data) {
        const { gameId, room } = res.data.data;
        socket.emit(SOCKET_EVENTS.JOIN_ROOM, { roomId, roomCode: room?.roomCode });
        if (gameId) {
          navigate(`/game/${gameId}`);
        }
      }
    } catch (err: any) {
      setLobbyNotice(
        err.response?.data?.message ||
          'Không thể tham gia phòng này. Phòng có thể đã đầy hoặc đã đóng — hãy tải lại danh sách.'
      );
    } finally {
      setJoiningRoomId(null);
    }
  };

  const filteredRooms = rooms.filter((r) => {
    if (!filterQuery.trim()) return true;
    const q = filterQuery.toLowerCase();
    return (
      r.name.toLowerCase().includes(q) ||
      r.roomCode.toLowerCase().includes(q) ||
      r.players[0]?.username?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 flex-1 flex flex-col gap-8">
      {/* Page Title & Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Sảnh Chờ & Ghép Trận
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Chọn hình thức thi đấu nhanh, luyện tập với máy hoặc tham gia các phòng cờ đang mở.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              setCreateRoomError('');
              setShowCreateModal(true);
            }}
            className="px-4 py-2.5 bg-white hover:bg-slate-50 active:scale-[0.98] border border-slate-300 text-slate-800 font-bold rounded-xl text-sm flex items-center gap-2 shadow-subtle hover:border-slate-400 transition-[background-color,border-color,transform] duration-150 ease-out"
          >
            <Plus className="w-4 h-4 text-slate-700" />
            <span>Tạo phòng mới</span>
          </button>
        </div>
      </div>

      {/* Quick Play Cards (3 columns) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Card 1: Matchmaking */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-card hover:shadow-card-hover transition-shadow duration-200 flex flex-col justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900 mb-1.5 flex items-center gap-2.5">
              <Swords className="w-5 h-5 text-sky-700 shrink-0" aria-hidden="true" />
              <span>Ghép Cặp Tự Động</span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mb-4 leading-relaxed">
              Tìm đối thủ cùng khoảng điểm ELO với mức thời&nbsp;gian{' '}
              <span className="font-semibold text-slate-700 whitespace-nowrap">{TIME_CONTROLS[selectedTimeKey].name}.</span>
            </p>
            <fieldset className="mb-5">
              <legend className="sr-only">Chọn mức thời gian ghép cặp</legend>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(TIME_CONTROLS).map(([key, val]) => {
                  const isSelected = selectedTimeKey === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      disabled={isSearchingMatch}
                      aria-pressed={isSelected}
                      onClick={() => setSelectedTimeKey(key as keyof typeof TIME_CONTROLS)}
                      className={`min-h-[44px] sm:min-h-[36px] px-3 py-2 sm:py-1.5 rounded-lg text-xs font-mono tabular-nums font-semibold border transition-colors duration-150 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
                        isSelected
                          ? 'bg-slate-900 border-slate-900 text-white'
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {val.name}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          </div>

          <div>
            {isSearchingMatch ? (
              <div
                role="status"
                aria-live="polite"
                className="p-4 bg-sky-50/90 border border-sky-200 rounded-xl text-center space-y-3"
              >
                <div className="flex items-center justify-center gap-2.5 text-sky-700 font-semibold text-sm">
                  <div className="w-4 h-4 border-2 border-sky-600 border-t-transparent rounded-full animate-spin" />
                  <span>
                    Đang tìm đối thủ... (
                    <span className="font-mono tabular-nums font-bold">{searchTimer}s</span>)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleCancelMatchmaking}
                  className="w-full py-2.5 min-h-[44px] bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 rounded-lg text-xs font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                >
                  Hủy Ghép Trận
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleStartMatchmaking}
                className="w-full py-3 bg-slate-900 hover:bg-slate-800 active:scale-[0.98] font-bold text-white rounded-xl shadow-sm transition-colors duration-150 flex items-center justify-center gap-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
              >
                <Swords className="w-4 h-4 text-sky-400" />
                <span>Tìm trận nhanh ({TIME_CONTROLS[selectedTimeKey].name})</span>
              </button>
            )}
          </div>
        </div>

        {/* Card 2: Play AI */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-card hover:shadow-card-hover transition-shadow duration-200 flex flex-col justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900 mb-1.5 flex items-center gap-2.5">
              <Bot className="w-5 h-5 text-indigo-600 shrink-0" aria-hidden="true" />
              <span>Đấu Với Máy AI</span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mb-6 leading-relaxed">
              Luyện cờ cùng thuật toán Minimax và Alpha-Beta với 3 mức độ Dễ, Trung bình, Khó.
            </p>
          </div>

          <button
            onClick={() => navigate('/ai')}
            className="w-full py-3 bg-white hover:bg-slate-50 border border-slate-200/90 font-bold text-slate-800 hover:text-sky-700 hover:border-slate-300 active:scale-[0.98] rounded-xl transition-[color,background-color,border-color,transform] duration-150 ease-out flex items-center justify-center gap-2 text-sm shadow-subtle"
          >
            <Bot className="w-4 h-4 text-sky-600" />
            <span>Chơi Với Máy Ngay</span>
          </button>
        </div>

        {/* Card 3: Join by Room Code */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-card hover:shadow-card-hover transition-shadow duration-200 flex flex-col justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900 mb-1.5 flex items-center gap-2.5">
              <Hash className="w-5 h-5 text-sky-700 shrink-0" aria-hidden="true" />
              <span>Nhập Mã Phòng</span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mb-4 leading-relaxed">
              Nhập mã 6 ký tự để tham gia phòng đấu riêng của bạn&nbsp;bè.
            </p>
          </div>

          <form onSubmit={handleJoinByCode} className="space-y-3">
            <label htmlFor="lobby-join-code" className="sr-only">
              Mã phòng 6 ký tự
            </label>
            <input
              id="lobby-join-code"
              type="text"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              aria-invalid={!!joinError}
              aria-describedby={joinError ? 'lobby-join-error' : undefined}
              placeholder="VD: K8X9B2"
              maxLength={10}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200/90 rounded-xl text-slate-900 uppercase tracking-widest text-center font-mono font-bold placeholder-slate-500 focus:outline-none focus:border-sky-500 focus:bg-white focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-1 text-base sm:text-sm transition-colors duration-150"
            />
            {joinError && (
              <p id="lobby-join-error" role="alert" className="text-xs text-rose-600 text-center font-medium">
                {joinError}
              </p>
            )}
            <button
              type="submit"
              disabled={isJoiningByCode}
              className="w-full py-2.5 bg-slate-800 hover:bg-slate-900 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none text-white font-bold rounded-xl shadow-sm transition-colors duration-150 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
            >
              {isJoiningByCode ? 'Đang tham gia...' : 'Tham Gia Bằng Mã'}
            </button>
          </form>
        </div>
      </div>

      {/* Public Rooms Section */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-card flex-1 flex flex-col">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center">
              <Users className="w-5 h-5 text-sky-600" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                <span>Phòng Đang Chờ Đối Thủ</span>
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-100 tabular-nums">
                  {rooms.length}
                </span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Các phòng công khai đang tìm kỳ thủ giao lưu
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Search Filter */}
            <div className="relative flex-1 sm:w-64">
              <label htmlFor="lobby-room-filter" className="sr-only">
                Lọc phòng hoặc chủ phòng
              </label>
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
              <input
                id="lobby-room-filter"
                type="search"
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
                placeholder="Lọc phòng hoặc chủ phòng..."
                className="w-full pl-9 pr-3 py-2 sm:py-1.5 text-base sm:text-sm bg-slate-50 border border-slate-200/90 rounded-xl focus:outline-none focus:border-sky-500 focus:bg-white focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-1 transition-colors"
              />
            </div>

            <button
              type="button"
              onClick={() => {
                setLobbyNotice('');
                refetchRooms();
              }}
              aria-label="Làm mới danh sách phòng"
              title="Làm mới"
              className="p-2 sm:p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-slate-50 hover:bg-slate-100 active:scale-[0.98] border border-slate-200/90 text-slate-600 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
            >
              <RefreshCw className={`w-4 h-4 ${isFetchingRooms ? 'animate-spin text-sky-600' : ''}`} />
            </button>
          </div>
        </div>

        {/* Room Grid */}
        <div className="flex-1 mt-6">
          {lobbyNotice && (
            <div
              role="alert"
              className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center justify-between gap-3 animate-in fade-in duration-150"
            >
              <div className="flex items-center gap-2 min-w-0">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" aria-hidden="true" />
                <span>{lobbyNotice}</span>
              </div>
              <button
                type="button"
                onClick={() => setLobbyNotice('')}
                aria-label="Đóng thông báo lỗi"
                className="min-h-[44px] min-w-[44px] sm:min-h-[32px] sm:min-w-[32px] shrink-0 flex items-center justify-center rounded-lg hover:bg-rose-100/70 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {isLoadingRooms ? (
            <div className="py-16 text-center text-slate-500 flex flex-col items-center">
              <div className="w-6 h-6 border-2 border-sky-600 border-t-transparent rounded-full animate-spin mb-3" />
              <span className="text-sm font-medium">Đang tải danh sách phòng...</span>
            </div>
          ) : isRoomsError ? (
            <div role="alert" className="py-16 text-center text-slate-600 flex flex-col items-center">
              <p className="text-base font-bold text-slate-800">Không thể tải danh sách phòng</p>
              <p className="text-xs text-slate-500 mt-1 max-w-sm">
                Đã xảy ra lỗi kết nối máy chủ. Vui lòng thử tải lại danh&nbsp;sách.
              </p>
              <button
                type="button"
                onClick={() => refetchRooms()}
                className="mt-4 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
              >
                Thử lại
              </button>
            </div>
          ) : filteredRooms.length === 0 ? (
            filterQuery.trim() ? (
              <div className="py-16 text-center text-slate-500 flex flex-col items-center">
                <div className="w-16 h-16 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center mb-3 text-slate-500">
                  <Search className="w-8 h-8" />
                </div>
                <p className="text-base font-bold text-slate-700">
                  Không tìm thấy phòng khớp &ldquo;{filterQuery.trim()}&rdquo;
                </p>
                <p className="text-xs text-slate-500 mt-1 max-w-sm">
                  Thử từ khóa khác hoặc xóa bộ lọc để xem toàn bộ phòng đang chờ.
                </p>
                <button
                  type="button"
                  onClick={() => setFilterQuery('')}
                  className="mt-4 px-4 py-2 min-h-[44px] bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                >
                  Xóa bộ lọc
                </button>
              </div>
            ) : (
              <div className="py-16 text-center text-slate-500 flex flex-col items-center">
                <div className="w-16 h-16 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center mb-3 text-slate-500">
                  <Users className="w-8 h-8" />
                </div>
                <p className="text-base font-bold text-slate-700">Chưa có phòng nào đang chờ</p>
                <p className="text-xs text-slate-500 mt-1 max-w-sm">
                  Hãy là người đầu tiên tạo phòng mới hoặc bấm Ghép Trận Nhanh để thi đấu!
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setCreateRoomError('');
                    setShowCreateModal(true);
                  }}
                  className="mt-4 px-4 py-2 min-h-[44px] bg-sky-700 hover:bg-sky-800 text-white rounded-xl text-xs font-bold transition-colors shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                >
                  Tạo phòng ngay
                </button>
              </div>
            )
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredRooms.map((r) => {
                const host = r.players[0];
                return (
                  <div
                    key={r.id}
                    className="p-4 bg-slate-50/60 hover:bg-white border border-slate-200/80 hover:border-sky-300 rounded-xl transition-colors duration-150 flex flex-col justify-between gap-4 hover:shadow-subtle group"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-mono text-xs px-2 py-0.5 rounded-lg bg-sky-50 text-sky-700 font-bold border border-sky-200/60">
                          #{r.roomCode}
                        </span>
                        <span className="flex items-center gap-1 text-xs text-slate-600 font-medium">
                          <Clock className="w-3.5 h-3.5 text-sky-600" />
                          <span className="font-mono tabular-nums">
                            {Math.round(r.initialTimeMs / 60000)}p
                            {r.incrementMs > 0 ? ` + ${r.incrementMs / 1000}s` : ''}
                          </span>
                        </span>
                      </div>

                      <h3 className="font-bold text-slate-900 text-sm truncate group-hover:text-sky-700 transition-colors">
                        {r.name}
                      </h3>

                      <div className="flex items-center gap-2 mt-2">
                        <div className="w-5 h-5 rounded-md bg-slate-200 text-slate-700 flex items-center justify-center text-xs font-bold">
                          {host?.username?.slice(0, 1).toUpperCase()}
                        </div>
                        <span className="text-xs text-slate-600">
                          Chủ phòng: <strong className="text-slate-900">{host?.username}</strong>
                        </span>
                        <span className="text-xs font-mono tabular-nums text-slate-600 font-semibold">
                          ({host?.eloRating} ELO)
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={joiningRoomId !== null}
                      onClick={() => handleJoinDirect(r.id)}
                      className="w-full py-2.5 min-h-[44px] bg-sky-700 hover:bg-sky-800 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none font-bold text-xs text-white rounded-lg transition-colors duration-150 shadow-sm flex items-center justify-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                    >
                      <span>{joiningRoomId === r.id ? 'Đang vào phòng...' : 'Vào Thách Đấu'}</span>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Create Room Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div
            ref={createModalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
            className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg max-h-[90dvh] overflow-y-auto p-6 sm:p-7 shadow-modal relative animate-in fade-in zoom-in-95 duration-150"
          >
            <button
              type="button"
              onClick={() => {
                setCreateRoomError('');
                setShowCreateModal(false);
              }}
              aria-label="Đóng cửa sổ tạo phòng"
              className="absolute top-4 right-4 p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-500 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
            >
              <X className="w-5 h-5" />
            </button>

            <h2 id="modal-title" className="text-xl font-extrabold text-slate-900 mb-1 pr-10">
              Tạo Phòng Chơi Mới
            </h2>
            <p className="text-xs text-slate-500 mb-6">
              Thiết lập cấu hình thời gian thi đấu và quy tắc ván cờ.
            </p>

            <form onSubmit={handleCreateRoom} className="space-y-4">
              {/* Room name */}
              <div>
                <label htmlFor="create-room-name" className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Tên phòng
                </label>
                <input
                  ref={roomNameInputRef}
                  id="create-room-name"
                  type="text"
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  placeholder={user?.username ? `Phòng của ${user.username}` : 'Ví dụ: Phòng cờ nhanh 5+0'}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-base sm:text-sm focus:outline-none focus:border-sky-500 focus:bg-white focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-1 transition-colors"
                />
              </div>

              {/* Time Control selection */}
              <fieldset>
                <legend className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Kiểm soát thời gian (Time control)
                </legend>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {Object.entries(TIME_CONTROLS).map(([key, val]) => {
                    const isSelected = selectedTimeKey === key;
                    const tc = val as any;
                    return (
                      <button
                        key={key}
                        type="button"
                        aria-pressed={isSelected}
                        onClick={() => setSelectedTimeKey(key as keyof typeof TIME_CONTROLS)}
                        className={`p-2.5 min-h-[44px] flex items-center justify-center rounded-xl text-xs font-semibold border transition-colors text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
                          isSelected
                            ? 'bg-slate-900 border-slate-900 text-white font-bold shadow-subtle'
                            : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {tc.name}
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              {/* Color preference */}
              <fieldset>
                <legend className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Màu quân ưu tiên
                </legend>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {[
                    { key: 'random', label: 'Ngẫu nhiên' },
                    { key: 'white', label: 'Quân Trắng' },
                    { key: 'black', label: 'Quân Đen' },
                  ].map((c) => {
                    const isSelected = colorPref === c.key;
                    return (
                      <button
                        key={c.key}
                        type="button"
                        aria-pressed={isSelected}
                        onClick={() => setColorPref(c.key as any)}
                        className={`p-2.5 min-h-[44px] flex items-center justify-center rounded-xl text-xs font-semibold border transition-colors text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
                          isSelected
                            ? 'bg-slate-900 border-slate-900 text-white font-bold shadow-subtle'
                            : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {c.label}
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              {/* Visibility mode */}
              <fieldset>
                <legend className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Chế độ hiển thị
                </legend>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    aria-pressed={visibility === 'PUBLIC'}
                    onClick={() => setVisibility('PUBLIC')}
                    className={`p-2.5 min-h-[44px] flex items-center justify-center rounded-xl text-xs font-semibold border transition-colors text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
                      visibility === 'PUBLIC'
                        ? 'bg-slate-900 border-slate-900 text-white font-bold shadow-subtle'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    Công khai (Sảnh chờ)
                  </button>
                  <button
                    type="button"
                    aria-pressed={visibility === 'PRIVATE'}
                    onClick={() => setVisibility('PRIVATE')}
                    className={`p-2.5 min-h-[44px] flex items-center justify-center rounded-xl text-xs font-semibold border transition-colors text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
                      visibility === 'PRIVATE'
                        ? 'bg-slate-900 border-slate-900 text-white font-bold shadow-subtle'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    Riêng tư (Chỉ bằng mã)
                  </button>
                </div>
              </fieldset>

              {createRoomError && (
                <div
                  role="alert"
                  className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-start gap-2 animate-in fade-in duration-150"
                >
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" aria-hidden="true" />
                  <span>{createRoomError}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="pt-4 flex flex-col-reverse sm:flex-row gap-2.5 sm:gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setCreateRoomError('');
                    setShowCreateModal(false);
                  }}
                  className="min-h-[44px] flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-sm transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isCreatingRoom}
                  className="min-h-[44px] flex-1 py-2.5 bg-slate-900 hover:bg-slate-800 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none text-white font-bold rounded-xl text-sm shadow-sm transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                >
                  {isCreatingRoom ? 'Đang tạo...' : 'Tạo Phòng'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
