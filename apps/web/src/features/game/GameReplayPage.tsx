import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Chessboard } from 'react-chessboard';
import { api } from '../../services/api';
import { useAuthStore } from '../../stores/authStore';
import {
  CHESS_BOARD_STYLE,
  CHESS_DARK_SQUARE_STYLE,
  CHESS_LIGHT_SQUARE_STYLE,
} from '../../lib/boardTheme';
import {
  History,
  RotateCcw,
  SkipBack,
  SkipForward,
  ChevronLeft,
  ChevronRight,
  Eye,
  Calendar,
} from 'lucide-react';

export default function GameReplayPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeReplayId = searchParams.get('replay');
  const { user } = useAuthStore();

  const [currentPlyIndex, setCurrentPlyIndex] = useState(0);
  const [boardOrientation, setBoardOrientation] = useState<'white' | 'black'>('white');

  // Fetch match history
  const {
    data: historyData,
    isLoading: isLoadingHistory,
    isError: isHistoryError,
    refetch: refetchHistory,
  } = useQuery({
    queryKey: ['myFullHistory'],
    queryFn: async () => {
      const res = await api.get('/games/history/me?limit=20');
      return res.data;
    },
  });

  // Fetch replay details when activeReplayId is selected
  const {
    data: replayData,
    isError: isReplayError,
    refetch: refetchReplay,
  } = useQuery({
    queryKey: ['gameReplay', activeReplayId],
    queryFn: async () => {
      if (!activeReplayId) return null;
      const res = await api.get(`/games/${activeReplayId}/replay`);
      return res.data.data;
    },
    enabled: !!activeReplayId,
  });

  const historyMoves = replayData?.history || [];
  const currentFen =
    historyMoves.length > 0 && historyMoves[currentPlyIndex]
      ? historyMoves[currentPlyIndex].fen
      : 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

  const selectGameToReplay = (gameId: string) => {
    setSearchParams({ replay: gameId });
    setCurrentPlyIndex(0);
  };

  const stepFirst = () => setCurrentPlyIndex(0);
  const stepPrev = () => setCurrentPlyIndex((prev) => Math.max(0, prev - 1));
  const stepNext = () =>
    setCurrentPlyIndex((prev) => Math.min(historyMoves.length - 1, prev + 1));
  const stepLast = () => setCurrentPlyIndex(historyMoves.length - 1);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 flex-1 flex flex-col lg:flex-row gap-6 items-start">
      <h1 className="sr-only">Lịch sử thi đấu và xem lại ván cờ</h1>
      {/* Left: Interactive Replay Viewer */}
      {activeReplayId && isReplayError ? (
        <div
          role="alert"
          className="flex-1 bg-white border border-rose-200 rounded-2xl p-12 text-center text-slate-600 shadow-card flex flex-col items-center justify-center min-h-[400px]"
        >
          <h2 className="text-lg font-bold text-slate-900 mb-1">Không thể tải dữ liệu ván đấu</h2>
          <p className="text-xs sm:text-sm text-slate-500 max-w-sm mb-4">
            Đã xảy ra lỗi khi tải biên bản nước đi. Vui lòng thử lại.
          </p>
          <button
            type="button"
            onClick={() => refetchReplay()}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
          >
            Thử lại
          </button>
        </div>
      ) : activeReplayId && replayData ? (
        <div className="flex-1 min-w-0 w-full max-w-2xl mx-auto flex flex-col gap-4">
          <div className="p-4 bg-white border border-slate-200/80 rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-card">
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
                <Eye className="w-5 h-5 shrink-0 text-sky-600" />
                <span className="truncate">Xem Lại Ván Đấu #{replayData.game.id.slice(0, 8)}</span>
              </h2>
              <div className="text-xs text-slate-500 mt-1 font-mono tabular-nums break-words">
                {replayData.game.whitePlayerName} ({replayData.game.whitePlayerRating}) vs{' '}
                {replayData.game.blackPlayerName} ({replayData.game.blackPlayerRating})
              </div>
            </div>

            <div className="text-right shrink-0">
              <span className="text-xs px-2.5 py-1 rounded-full bg-sky-50 text-sky-700 font-bold border border-sky-200/70">
                {replayData.game.result}
              </span>
              <div className="text-xs text-slate-600 mt-1 font-semibold">
                {replayData.game.terminationReason}
              </div>
            </div>
          </div>

          {/* Chessboard View */}
          <div className="w-full aspect-square bg-white p-2.5 sm:p-3 rounded-2xl shadow-card border border-slate-200/90">
            <Chessboard
              position={currentFen}
              boardOrientation={boardOrientation}
              arePiecesDraggable={false}
              customBoardStyle={CHESS_BOARD_STYLE}
              customDarkSquareStyle={CHESS_DARK_SQUARE_STYLE}
              customLightSquareStyle={CHESS_LIGHT_SQUARE_STYLE}
            />
          </div>

          {/* Stepper Controls */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-2 shadow-card">
            <button
              onClick={() =>
                setBoardOrientation((prev) => (prev === 'white' ? 'black' : 'white'))
              }
              aria-label="Xoay hướng bàn cờ"
              className="min-h-[44px] min-w-[44px] px-3 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/80 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-subtle active:scale-[0.98]"
            >
              <RotateCcw className="w-4 h-4 text-sky-600" />
              <span className="hidden sm:inline">Xoay bàn</span>
            </button>

            <div className="flex items-center gap-1.5 sm:gap-2">
              <button
                onClick={stepFirst}
                disabled={currentPlyIndex === 0}
                aria-label="Nước đầu tiên"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center bg-slate-50 hover:bg-slate-100 border border-slate-200/80 disabled:opacity-40 text-slate-700 rounded-xl transition-colors shadow-subtle active:scale-[0.98]"
                title="Đầu ván"
              >
                <SkipBack className="w-4 h-4" />
              </button>
              <button
                onClick={stepPrev}
                disabled={currentPlyIndex === 0}
                aria-label="Nước trước"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center bg-slate-50 hover:bg-slate-100 border border-slate-200/80 disabled:opacity-40 text-slate-700 rounded-xl transition-colors shadow-subtle active:scale-[0.98]"
                title="Nước trước"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>

              <span className="font-mono tabular-nums text-xs font-bold text-slate-800 px-2 sm:px-3">
                {currentPlyIndex} / {Math.max(0, historyMoves.length - 1)}
              </span>

              <button
                onClick={stepNext}
                disabled={currentPlyIndex >= historyMoves.length - 1}
                aria-label="Nước kế tiếp"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center bg-slate-50 hover:bg-slate-100 border border-slate-200/80 disabled:opacity-40 text-slate-700 rounded-xl transition-colors shadow-subtle active:scale-[0.98]"
                title="Nước sau"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
              <button
                onClick={stepLast}
                disabled={currentPlyIndex >= historyMoves.length - 1}
                aria-label="Nước cuối cùng"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center bg-slate-50 hover:bg-slate-100 border border-slate-200/80 disabled:opacity-40 text-slate-700 rounded-xl transition-colors shadow-subtle active:scale-[0.98]"
                title="Cuối ván"
              >
                <SkipForward className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Move SAN list table */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-card max-h-48 overflow-y-auto">
            <div className="text-xs font-bold text-slate-600 mb-2">
              Biên bản nước đi (SAN)
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono tabular-nums">
              {historyMoves.map((h: any, idx: number) => (
                <button
                  key={idx}
                  onClick={() => setCurrentPlyIndex(idx)}
                  className={`px-2.5 py-2 min-h-[44px] sm:min-h-[36px] rounded-lg text-left transition-colors duration-150 ${
                    idx === currentPlyIndex
                      ? 'bg-sky-50 text-sky-700 font-bold border border-sky-300'
                      : 'hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  {idx === 0
                    ? 'Bắt đầu'
                    : `${Math.ceil(idx / 2)}${idx % 2 === 1 ? '.' : '...'} ${h.san}`}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 bg-white border border-slate-200/80 rounded-2xl p-12 text-center text-slate-500 shadow-card flex flex-col items-center justify-center min-h-[400px]">
          <div className="w-16 h-16 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-center text-slate-500 mb-4">
            <History className="w-8 h-8" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 mb-1">Chọn Một Trận Đấu Để Xem Lại</h2>
          <p className="text-xs sm:text-sm text-slate-500 max-w-sm">
            Duyệt danh sách các ván đấu đã diễn ra bên cạnh và chọn một trận để phân tích chi tiết.
          </p>
        </div>
      )}

      {/* Right: History match list */}
      <div className="w-full lg:w-96 min-w-0 bg-white border border-slate-200/80 rounded-2xl p-5 sm:p-6 shadow-card flex flex-col gap-4 self-stretch max-h-[800px]">
        <div className="flex items-center gap-2 pb-4 border-b border-slate-100">
          <History className="w-5 h-5 text-sky-600" />
          <h2 className="font-bold text-slate-900 text-base">Lịch Sử Thi Đấu</h2>
        </div>

        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          {isLoadingHistory ? (
            <div className="p-8 text-center text-slate-500 text-xs flex flex-col items-center">
              <div className="w-5 h-5 border-2 border-sky-600 border-t-transparent rounded-full animate-spin mb-2" />
              <span>Đang tải lịch sử...</span>
            </div>
          ) : isHistoryError ? (
            <div role="alert" className="p-8 text-center text-slate-600 text-xs space-y-3">
              <p className="font-semibold text-slate-800">Không thể tải lịch sử đấu.</p>
              <button
                type="button"
                onClick={() => refetchHistory()}
                className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
              >
                Thử lại
              </button>
            </div>
          ) : !historyData?.data || historyData.data.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs">
              Chưa có trận đấu nào được ghi nhận.
            </div>
          ) : (
            historyData.data.map((g: any) => {
              const isWhite = g.whitePlayerId === user?.id;
              const opponent = isWhite ? g.blackPlayerName : g.whitePlayerName;
              const isSelected = activeReplayId === g.id;

              return (
                <button
                  type="button"
                  key={g.id}
                  onClick={() => selectGameToReplay(g.id)}
                  aria-pressed={isSelected}
                  className={`w-full text-left p-3.5 rounded-xl border transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
                    isSelected
                      ? 'bg-sky-50/90 border-sky-400 shadow-subtle ring-1 ring-sky-300'
                      : 'bg-slate-50/70 hover:bg-white border-slate-200/80 hover:border-sky-300 hover:shadow-subtle'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1.5 min-w-0">
                    <span className="font-bold text-slate-900 text-xs truncate min-w-0 flex-1">
                      Vs {opponent || 'Máy AI'}
                    </span>
                    <span className="text-xs text-slate-600 flex items-center gap-1 font-mono tabular-nums font-medium flex-shrink-0">
                      <Calendar className="w-3 h-3 text-slate-500" />
                      {new Date(g.createdAt).toLocaleDateString('vi-VN')}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2 text-xs min-w-0">
                    <span className="text-slate-500 text-xs truncate min-w-0">
                      {isWhite ? 'Quân Trắng' : 'Quân Đen'} • {g.gameMode}
                    </span>
                    <span className="font-bold text-sky-700 text-xs uppercase flex-shrink-0">
                      {g.result || 'Đang đấu'}
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
