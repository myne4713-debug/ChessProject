import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Chessboard } from 'react-chessboard';
import { Chess, Square } from 'chess.js';
import { fireConfetti } from '../../lib/confetti';
import { api } from '../../services/api';
import { getSocket } from '../../services/socket';
import { useAuthStore } from '../../stores/authStore';
import { soundManager } from '../../lib/sound';
import { buildShareInviteLink, notifyDesktop } from '../../lib/desktop';
import { useDialogFocusTrap } from '../../hooks/useDialogFocusTrap';
import { findKingSquare } from '../../lib/chessUtils';
import {
  GameState,
  MoveResultPayload,
  ChatMessage,
  GameOverPayload,
  ClockUpdatePayload,
  SOCKET_EVENTS,
} from '@online-chess/shared';
import {
  RotateCcw,
  Flag,
  Handshake,
  Send,
  MessageSquare,
  AlertCircle,
  Trophy,
  History,
  Volume2,
  VolumeX,
  Copy,
  Check,
  Share2,
  Swords,
  Lightbulb,
  ShieldAlert,
  X,
} from 'lucide-react';
import { PieceSvg } from '../../components/chess/PieceSvg';
import { PromotionModal } from './components/PromotionModal';
import { PlayerClock } from './components/PlayerClock';
import {
  CHESS_BOARD_STYLE,
  CHESS_DARK_SQUARE_STYLE,
  CHESS_LIGHT_SQUARE_STYLE,
  buildSquareHighlightStyles,
} from '../../lib/boardTheme';

export default function GamePage() {
  const { id: gameId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuthStore();
  const socket = getSocket();

  const isWaitingRoom = gameId === 'waiting';
  const roomIdParam = searchParams.get('roomId');
  const roomCodeParam = searchParams.get('code');
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(soundManager.isEnabled());

  const toggleSound = () => {
    const next = soundManager.toggle();
    setSoundEnabled(next);
  };

  const [gameState, setGameState] = useState<GameState | null>(null);
  const [boardFen, setBoardFen] = useState('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
  const [orientation, setOrientation] = useState<'white' | 'black'>('white');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [gameOverData, setGameOverData] = useState<GameOverPayload | null>(null);

  // Server-synced clocks (updated only on state fetch, move, or sync tick; countdown lives inside PlayerClock)
  const [clockSync, setClockSync] = useState<{
    whiteMs: number;
    blackMs: number;
    timestamp: number;
  }>({
    whiteMs: 300000,
    blackMs: 300000,
    timestamp: Date.now(),
  });

  // Modals & offers
  const [incomingDrawOffer, setIncomingDrawOffer] = useState<string | null>(null);
  const [showResignModal, setShowResignModal] = useState(false);
  const [drawOfferSent, setDrawOfferSent] = useState(false);
  const [statusNotice, setStatusNotice] = useState<{
    type: 'info' | 'error';
    message: string;
  } | null>(null);
  const noticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showStatusNotice = useCallback((type: 'info' | 'error', message: string) => {
    setStatusNotice({ type, message });
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = setTimeout(() => {
      setStatusNotice(null);
    }, 5000);
  }, []);

  useEffect(() => {
    return () => {
      if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    };
  }, []);
  const [lastMoveSquares, setLastMoveSquares] = useState<{ from?: string; to?: string }>({});
  const [pendingPromotion, setPendingPromotion] = useState<{
    from: string;
    to: string;
    color: 'w' | 'b';
  } | null>(null);

  // Legal moves & check highlights
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [possibleMoves, setPossibleMoves] = useState<Square[]>([]);
  const [captureMoves, setCaptureMoves] = useState<Set<Square>>(new Set());
  const [showHints, setShowHints] = useState(true);
  const [isCheck, setIsCheck] = useState(false);

  const drawModalRef = useDialogFocusTrap<HTMLDivElement>({
    isOpen: !!incomingDrawOffer,
    onClose: () => handleRejectDraw(),
  });

  const resignModalRef = useDialogFocusTrap<HTMLDivElement>({
    isOpen: showResignModal,
    onClose: () => setShowResignModal(false),
  });

  const gameOverModalRef = useDialogFocusTrap<HTMLDivElement>({
    isOpen: !!gameOverData,
  });

  const chatContainerRef = useRef<HTMLDivElement>(null);
  const moveHistoryContainerRef = useRef<HTMLDivElement>(null);
  const localChessRef = useRef(new Chess());
  const gameStateRef = useRef<GameState | null>(null);
  gameStateRef.current = gameState;
  const isDraggingPieceRef = useRef(false);

  const clearSelection = useCallback(() => {
    isDraggingPieceRef.current = false;
    setSelectedSquare(null);
    setPossibleMoves([]);
    setCaptureMoves(new Set());
  }, []);

  useEffect(() => {
    const handleWindowBlur = () => {
      if (isDraggingPieceRef.current) {
        clearSelection();
      }
    };
    window.addEventListener('blur', handleWindowBlur);
    return () => window.removeEventListener('blur', handleWindowBlur);
  }, [clearSelection]);

  const syncClocks = (whiteMs: number, blackMs: number) => {
    setClockSync({
      whiteMs,
      blackMs,
      timestamp: Date.now(),
    });
  };

  // Determine user's assigned color
  const isWhitePlayer = gameState?.whitePlayerId === user?.id;
  const isBlackPlayer = gameState?.blackPlayerId === user?.id;
  const isPlayer = isWhitePlayer || isBlackPlayer;

  // Waiting room socket listeners & polling fallback
  useEffect(() => {
    if (!isWaitingRoom) return;

    if (roomIdParam) {
      socket.emit(SOCKET_EVENTS.JOIN_ROOM, { roomId: roomIdParam, roomCode: roomCodeParam });
    }

    const handleRoomUpdated = (room: any) => {
      if (room?.gameId) {
        navigate(`/game/${room.gameId}`);
      }
    };

    const handleGameState = (state: any) => {
      if (state?.id) {
        navigate(`/game/${state.id}`);
      }
    };

    const handleMatchFound = (data: any) => {
      if (data?.gameId) {
        notifyDesktop({
          title: 'Trận đấu đã bắt đầu!',
          body: 'Đối thủ đã vào phòng. Nhấn để quay lại bàn cờ.',
          route: `/game/${data.gameId}`,
        });
        navigate(`/game/${data.gameId}`);
      }
    };

    socket.on(SOCKET_EVENTS.ROOM_UPDATED, handleRoomUpdated);
    socket.on(SOCKET_EVENTS.GAME_STATE, handleGameState);
    socket.on(SOCKET_EVENTS.MATCH_FOUND, handleMatchFound);
    socket.on('GAME_STARTED', handleMatchFound);

    const pollInterval = setInterval(async () => {
      if (roomIdParam) {
        try {
          const res = await api.get(`/rooms/${roomIdParam}`);
          if (res.data?.success && res.data?.data?.gameId) {
            navigate(`/game/${res.data.data.gameId}`);
          }
        } catch {}
      }
    }, 2500);

    return () => {
      socket.off(SOCKET_EVENTS.ROOM_UPDATED, handleRoomUpdated);
      socket.off(SOCKET_EVENTS.GAME_STATE, handleGameState);
      socket.off(SOCKET_EVENTS.MATCH_FOUND, handleMatchFound);
      socket.off('GAME_STARTED', handleMatchFound);
      clearInterval(pollInterval);
    };
  }, [isWaitingRoom, roomIdParam, roomCodeParam, socket, navigate]);

  const copyCode = () => {
    if (roomCodeParam) {
      navigator.clipboard.writeText(roomCodeParam);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const copyInviteLink = () => {
    if (roomCodeParam) {
      const link = buildShareInviteLink(roomCodeParam);
      navigator.clipboard.writeText(link);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const handleCancelWaitingRoom = async () => {
    if (roomIdParam) {
      try {
        await api.post(`/rooms/${roomIdParam}/leave`);
      } catch {}
      socket.emit(SOCKET_EVENTS.LEAVE_ROOM, { roomId: roomIdParam });
    }
    navigate('/lobby');
  };

  // Set orientation according to assigned player color
  useEffect(() => {
    if (gameState && user) {
      if (gameState.blackPlayerId === user.id && gameState.whitePlayerId !== user.id) {
        setOrientation('black');
      } else {
        setOrientation('white');
      }
    }
  }, [gameState?.whitePlayerId, gameState?.blackPlayerId, user]);

  // Request game state & setup socket listeners
  useEffect(() => {
    if (!gameId || isWaitingRoom) return;

    socket.emit(SOCKET_EVENTS.REQUEST_GAME_STATE, { gameId }, (res: any) => {
      if (res?.success && res.data) {
        setGameState(res.data.state);
        setBoardFen(res.data.state.currentFen);
        localChessRef.current = new Chess(res.data.state.currentFen);
        setIsCheck(res.data.state.isCheck ?? localChessRef.current.inCheck());
        setSelectedSquare(null);
        setPossibleMoves([]);
        setCaptureMoves(new Set());
        syncClocks(
          res.data.state.whiteRemainingMs,
          res.data.state.blackRemainingMs
        );
        if (res.data.messages) {
          setChatMessages(res.data.messages);
        }
      }
    });

    const handleMoveResult = (payload: MoveResultPayload) => {
      setBoardFen(payload.fen);
      localChessRef.current = new Chess(payload.fen);
      setIsCheck(payload.isCheck ?? localChessRef.current.inCheck());
      setSelectedSquare(null);
      setPossibleMoves([]);
      setCaptureMoves(new Set());
      setDrawOfferSent(false);
      syncClocks(payload.whiteRemainingMs, payload.blackRemainingMs);
      setLastMoveSquares({ from: payload.move.fromSquare, to: payload.move.toSquare });

      if (payload.isGameOver) {
        soundManager.play('gameover');
      } else if (payload.isCheck) {
        soundManager.play('check');
      } else if (payload.move?.san?.includes('x')) {
        soundManager.play('capture');
      } else {
        soundManager.play('move');
      }

      setGameState((prev) => {
        if (!prev) return prev;
        const userColor =
          prev.whitePlayerId === user?.id ? 'w' : prev.blackPlayerId === user?.id ? 'b' : null;
        if (!payload.isGameOver && userColor && payload.currentTurn === userColor) {
          notifyDesktop({
            title: payload.isCheck ? 'Chiếu tướng — Đến lượt bạn đi!' : 'Đến lượt bạn đi',
            body: `Đối thủ vừa đi ${payload.move.san}.`,
            route: `/game/${gameId}`,
          });
        }
        return {
          ...prev,
          currentFen: payload.fen,
          currentTurn: payload.currentTurn,
          positionVersion: payload.positionVersion,
          isCheck: payload.isCheck,
          moves: [...prev.moves, payload.move],
        };
      });
    };

    const handleClockSync = (payload: ClockUpdatePayload) => {
      syncClocks(payload.whiteRemainingMs, payload.blackRemainingMs);
    };

    const handleGameOver = (payload: GameOverPayload) => {
      setGameOverData(payload);
      setIsCheck(false);
      setDrawOfferSent(false);
      setStatusNotice(null);
      setSelectedSquare(null);
      setPossibleMoves([]);
      setCaptureMoves(new Set());
      soundManager.play('gameover');
      notifyDesktop({
        title: 'Ván đấu đã kết thúc',
        body:
          payload.winnerId === user?.id
            ? 'Chúc mừng bạn đã giành chiến thắng!'
            : payload.result === 'DRAW'
            ? 'Trận đấu kết thúc với kết quả hòa.'
            : 'Trận đấu đã kết thúc. Nhấn để xem kết quả.',
        route: `/game/${gameId}`,
      });
      if (payload.winnerId === user?.id) {
        fireConfetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
      }
    };

    const handleChatMessage = (msg: ChatMessage) => {
      setChatMessages((prev) => [...prev, msg]);
    };

    const handleDrawOffered = (data: { offeredBy: string }) => {
      setIncomingDrawOffer(data.offeredBy);
      notifyDesktop({
        title: 'Lời mời hòa',
        body: 'Đối thủ vừa gửi đề nghị hòa ván cờ.',
        route: `/game/${gameId}`,
      });
    };

    const handleError = (err?: { message?: string }) => {
      // Revert optimistic move on socket rejection
      const current = gameStateRef.current;
      if (current) {
        setBoardFen(current.currentFen);
        localChessRef.current = new Chess(current.currentFen);
      }
      if (err?.message) {
        showStatusNotice('error', err.message);
      }
    };

    socket.on(SOCKET_EVENTS.MOVE_RESULT, handleMoveResult);
    socket.on(SOCKET_EVENTS.CLOCK_UPDATE, handleClockSync);
    socket.on(SOCKET_EVENTS.GAME_OVER, handleGameOver);
    socket.on(SOCKET_EVENTS.CHAT_MESSAGE, handleChatMessage);
    socket.on(SOCKET_EVENTS.DRAW_OFFERED, handleDrawOffered);
    socket.on(SOCKET_EVENTS.ERROR, handleError);

    return () => {
      socket.off(SOCKET_EVENTS.MOVE_RESULT, handleMoveResult);
      socket.off(SOCKET_EVENTS.CLOCK_UPDATE, handleClockSync);
      socket.off(SOCKET_EVENTS.GAME_OVER, handleGameOver);
      socket.off(SOCKET_EVENTS.CHAT_MESSAGE, handleChatMessage);
      socket.off(SOCKET_EVENTS.DRAW_OFFERED, handleDrawOffered);
      socket.off(SOCKET_EVENTS.ERROR, handleError);
    };
  }, [gameId, isWaitingRoom, socket, user?.id]);

  const handleClaimTimeout = useCallback(() => {
    if (isPlayer && gameId) {
      socket.emit(SOCKET_EVENTS.CLAIM_TIMEOUT, { gameId });
    }
  }, [isPlayer, gameId, socket]);

  // Auto-scroll chat internally to bottom without scrolling window
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatMessages]);

  // Auto-scroll move history container internally
  useEffect(() => {
    if (moveHistoryContainerRef.current) {
      moveHistoryContainerRef.current.scrollTop = moveHistoryContainerRef.current.scrollHeight;
    }
  }, [gameState?.moves?.length]);

  const dispatchMove = (sourceSquare: string, targetSquare: string, promotion: string = 'q'): boolean => {
    try {
      const moveAttempt = localChessRef.current.move({
        from: sourceSquare,
        to: targetSquare,
        promotion,
      });
      if (!moveAttempt) return false;

      // Optimistically update board and check status
      setBoardFen(localChessRef.current.fen());
      setIsCheck(localChessRef.current.inCheck());
      setLastMoveSquares({ from: sourceSquare, to: targetSquare });

      if (moveAttempt.captured) {
        soundManager.play('capture');
      } else {
        soundManager.play('move');
      }
    } catch {
      return false;
    }

    socket.emit(
      SOCKET_EVENTS.MOVE,
      {
        gameId,
        from: sourceSquare,
        to: targetSquare,
        promotion,
        expectedVersion: gameState?.positionVersion ?? 0,
      },
      (res: any) => {
        if (!res?.success) {
          // Revert optimistic move on server move rejection
          if (gameState) {
            setBoardFen(gameState.currentFen);
            localChessRef.current = new Chess(gameState.currentFen);
            setIsCheck(localChessRef.current.inCheck());
          }
        }
      }
    );

    return true;
  };

  const onPieceDrop = (sourceSquare: string, targetSquare: string): boolean => {
    clearSelection();

    if (!isPlayer || !gameId || gameOverData || !isMyTurn) return false;

    // Detect pawn promotion to last rank
    const piece = localChessRef.current.get(sourceSquare as Square);
    const isPawnPromotion =
      piece &&
      piece.type === 'p' &&
      ((piece.color === 'w' && targetSquare.endsWith('8')) ||
        (piece.color === 'b' && targetSquare.endsWith('1')));

    if (isPawnPromotion) {
      try {
        const testAttempt = localChessRef.current.move({
          from: sourceSquare,
          to: targetSquare,
          promotion: 'q',
        });
        if (!testAttempt) return false;
        localChessRef.current.undo();
        setPendingPromotion({ from: sourceSquare, to: targetSquare, color: piece.color });
        return false;
      } catch {
        return false;
      }
    }

    return dispatchMove(sourceSquare, targetSquare, 'q');
  };

  const handleSquareClick = (square: Square) => {
    if (!isPlayer || !gameId || gameOverData || !isMyTurn) return;

    const myColor = isWhitePlayer ? 'w' : 'b';

    // If a piece is already selected and target square is a legal destination -> Move!
    if (selectedSquare && possibleMoves.includes(square)) {
      const piece = localChessRef.current.get(selectedSquare);
      const isPawnPromotion =
        piece &&
        piece.type === 'p' &&
        ((piece.color === 'w' && square.endsWith('8')) ||
          (piece.color === 'b' && square.endsWith('1')));

      if (isPawnPromotion) {
        setPendingPromotion({ from: selectedSquare, to: square, color: piece.color });
        setSelectedSquare(null);
        setPossibleMoves([]);
        setCaptureMoves(new Set());
        return;
      }

      dispatchMove(selectedSquare, square, 'q');
      setSelectedSquare(null);
      setPossibleMoves([]);
      setCaptureMoves(new Set());
      return;
    }

    // Check if clicked square has a piece belonging to the current player
    const piece = localChessRef.current.get(square);
    if (piece && piece.color === myColor) {
      setSelectedSquare(square);
      const moves = localChessRef.current.moves({ square, verbose: true });
      setPossibleMoves(moves.map((m) => m.to as Square));
      setCaptureMoves(new Set(moves.filter((m) => !!m.captured).map((m) => m.to as Square)));
    } else {
      // Clicked on empty square or opponent piece without valid selection -> Deselect
      setSelectedSquare(null);
      setPossibleMoves([]);
      setCaptureMoves(new Set());
    }
  };

  const handlePieceDragBegin = (_piece: string, sourceSquare: Square) => {
    if (!isPlayer || !gameId || gameOverData || !isMyTurn) return;

    const myColor = isWhitePlayer ? 'w' : 'b';
    const pieceObj = localChessRef.current.get(sourceSquare);

    if (pieceObj && pieceObj.color === myColor) {
      isDraggingPieceRef.current = true;
      setSelectedSquare(sourceSquare);
      const moves = localChessRef.current.moves({ square: sourceSquare, verbose: true });
      setPossibleMoves(moves.map((m) => m.to as Square));
      setCaptureMoves(new Set(moves.filter((m) => !!m.captured).map((m) => m.to as Square)));
    }
  };

  const handlePieceDragEnd = useCallback(() => {
    clearSelection();
  }, [clearSelection]);

  const handlePromotionSelect = (promPiece: 'q' | 'r' | 'b' | 'n') => {
    if (!pendingPromotion) return;
    const { from, to } = pendingPromotion;
    setPendingPromotion(null);
    dispatchMove(from, to, promPiece);
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || !gameId) return;

    socket.emit(SOCKET_EVENTS.CHAT, {
      gameId,
      message: inputMessage.trim(),
    });
    setInputMessage('');
  };

  const handleResign = () => {
    if (!gameId) return;
    socket.emit(SOCKET_EVENTS.RESIGN, { gameId });
    setShowResignModal(false);
  };

  const handleOfferDraw = () => {
    if (!gameId || drawOfferSent) return;
    socket.emit(SOCKET_EVENTS.DRAW_OFFER, { gameId });
    setDrawOfferSent(true);
    showStatusNotice('info', 'Đã gửi đề nghị hòa tới đối thủ. Chờ phản hồi.');
  };

  const handleAcceptDraw = () => {
    if (!gameId) return;
    socket.emit(SOCKET_EVENTS.DRAW_ACCEPT, { gameId });
    setIncomingDrawOffer(null);
  };

  const handleRejectDraw = () => {
    if (!gameId) return;
    socket.emit(SOCKET_EVENTS.DRAW_REJECT, { gameId });
    setIncomingDrawOffer(null);
  };

  const isMyTurn =
    gameState?.status === 'IN_PROGRESS' &&
    ((gameState?.currentTurn === 'w' && isWhitePlayer) ||
      (gameState?.currentTurn === 'b' && isBlackPlayer));

  // Memoize custom square highlighting for moves, selection, hints & king in check
  const customSquareStyles = useMemo(() => {
    const kingSq = isCheck
      ? findKingSquare(localChessRef.current, localChessRef.current.turn())
      : null;

    return buildSquareHighlightStyles({
      lastMoveSquares,
      selectedSquare,
      showHints,
      possibleMoves,
      captureMoves,
      kingInCheckSquare: kingSq,
    });
  }, [lastMoveSquares, selectedSquare, showHints, possibleMoves, captureMoves, isCheck, boardFen]);

  const isTopPlayerTurn =
    gameState?.currentTurn === (orientation === 'white' ? 'b' : 'w') && !gameOverData;
  const isBottomPlayerTurn =
    gameState?.currentTurn === (orientation === 'white' ? 'w' : 'b') && !gameOverData;

  const isTopInCheck = isCheck && gameState?.currentTurn === (orientation === 'white' ? 'b' : 'w');
  const isBottomInCheck = isCheck && gameState?.currentTurn === (orientation === 'white' ? 'w' : 'b');

  const topClockMs = orientation === 'white' ? clockSync.blackMs : clockSync.whiteMs;
  const bottomClockMs = orientation === 'white' ? clockSync.whiteMs : clockSync.blackMs;

  if (isWaitingRoom) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 flex-1 flex flex-col items-center justify-center">
        <div className="w-full bg-white border border-slate-200/80 rounded-3xl p-8 sm:p-10 shadow-card text-center relative overflow-hidden">
          {/* Animated pulse radar */}
          <div className="relative w-20 h-20 mx-auto mb-6 flex items-center justify-center">
            <span className="absolute inset-0 rounded-full bg-sky-400/20 animate-ping" />
            <span className="absolute inset-2 rounded-full bg-sky-200/40 animate-pulse" />
            <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 text-white flex items-center justify-center shadow-md relative z-10">
              <Swords className="w-8 h-8" />
            </div>
          </div>

          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight mb-2">
            Đang Chờ Đối Thủ Tham Gia
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto mb-8 leading-relaxed">
            Phòng đấu đã được khởi tạo. Hãy gửi mã phòng hoặc link mời trực tiếp cho bạn bè để bắt đầu thi đấu.
          </p>

          {/* Room Code Card */}
          <div className="border-y border-slate-200/80 py-6 mb-6 flex flex-col items-center gap-3">
            <span className="text-xs font-semibold text-slate-600">
              Mã phòng của bạn
            </span>
            <div className="font-mono text-3xl sm:text-4xl font-black text-sky-700 tracking-widest tabular-nums select-all">
              {roomCodeParam || '...'}
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2.5 mt-2">
              <button
                type="button"
                onClick={copyCode}
                className="px-4 py-2 min-h-[44px] bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow-subtle transition-colors active:scale-[0.98]"
              >
                {copiedCode ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-slate-500" />}
                <span>{copiedCode ? 'Đã sao chép mã!' : 'Sao chép mã'}</span>
              </button>
              <button
                type="button"
                onClick={copyInviteLink}
                className="px-4 py-2 min-h-[44px] bg-slate-900 hover:bg-slate-800 active:scale-[0.98] text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow-sm transition-colors"
              >
                {copiedLink ? <Check className="w-4 h-4 text-white" /> : <Share2 className="w-4 h-4 text-white" />}
                <span>{copiedLink ? 'Đã sao chép link!' : 'Sao chép link mời'}</span>
              </button>
            </div>
          </div>

          {/* Cancel button */}
          <button
            type="button"
            onClick={handleCancelWaitingRoom}
            className="w-full py-3 bg-white hover:bg-rose-50 text-rose-700 hover:text-rose-800 border border-slate-200 hover:border-rose-200 rounded-xl text-xs sm:text-sm font-semibold transition-colors active:scale-[0.98]"
          >
            Hủy Phòng & Quay Lại Sảnh Chờ
          </button>
        </div>
      </div>
    );
  }

  const liveStatusAnnouncement = gameOverData
    ? `Trận đấu kết thúc: ${
        gameOverData.result === 'WHITE_WON'
          ? 'Quân Trắng thắng'
          : gameOverData.result === 'BLACK_WON'
          ? 'Quân Đen thắng'
          : 'Trận đấu hòa'
      }`
    : isCheck
    ? `Chiếu tướng! ${isMyTurn ? 'Đến lượt bạn' : 'Đến lượt đối thủ'}`
    : isMyTurn
    ? 'Đến lượt bạn'
    : gameState?.status === 'IN_PROGRESS'
    ? 'Đến lượt đối thủ'
    : '';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 flex-1 flex flex-col lg:flex-row gap-6 items-start">
      <h1 className="sr-only">Phòng thi đấu cờ vua trực tuyến</h1>
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {liveStatusAnnouncement}
      </div>
      {/* Left: Chessboard & Player Info */}
      <div className="flex-1 min-w-0 w-full max-w-2xl mx-auto flex flex-col gap-3">
        {/* Top Player (Opponent) */}
        <div
          className={`p-3.5 sm:p-4 rounded-2xl border flex items-center justify-between gap-3 transition-[background-color,border-color,box-shadow] duration-150 ${
            isTopInCheck && !gameOverData
              ? 'bg-rose-50/70 border-rose-400 shadow-card ring-1 ring-rose-300'
              : isTopPlayerTurn
              ? 'bg-sky-50/90 border-sky-400 shadow-card ring-1 ring-sky-300'
              : 'bg-white border-slate-200/80 shadow-subtle'
          }`}
        >
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-10 h-10 shrink-0 rounded-xl bg-slate-100 flex items-center justify-center border border-slate-200 shadow-sm">
              <PieceSvg type="k" color={orientation === 'white' ? 'b' : 'w'} className="w-6 h-6" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-bold text-slate-900 text-sm flex flex-wrap items-center gap-2">
                <span className="truncate">
                  {orientation === 'white'
                    ? gameState?.blackPlayerName || 'Đối thủ'
                    : gameState?.whitePlayerName || 'Đối thủ'}
                </span>
                {isTopInCheck && !gameOverData && (
                  <span className="flex items-center gap-1 text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full animate-pulse">
                    <ShieldAlert className="w-3.5 h-3.5" />
                    Chiếu tướng!
                  </span>
                )}
              </div>
              <div className="text-xs text-slate-500 font-mono tabular-nums">
                ELO:{' '}
                {orientation === 'white'
                  ? gameState?.blackPlayerRating || 1200
                  : gameState?.whitePlayerRating || 1200}
              </div>
            </div>
          </div>

          {/* Clock */}
          <PlayerClock
            syncedMs={topClockMs}
            syncTimestamp={clockSync.timestamp}
            isRunning={!!isTopPlayerTurn && gameState?.status === 'IN_PROGRESS' && !gameOverData}
            isActive={!!isTopPlayerTurn}
            onTimeout={isPlayer ? handleClaimTimeout : undefined}
          />
        </div>

        {/* The Interactive Chessboard */}
        <div
          onPointerCancel={clearSelection}
          onTouchCancel={clearSelection}
          className="w-full aspect-square bg-white p-2.5 sm:p-3 rounded-2xl shadow-card border border-slate-200/90 board-touch-surface touch-none select-none"
        >
          <Chessboard
            position={boardFen}
            onPieceDrop={onPieceDrop}
            onSquareClick={handleSquareClick}
            onPieceDragBegin={handlePieceDragBegin}
            onPieceDragEnd={handlePieceDragEnd}
            onPieceDropOffBoard={clearSelection}
            boardOrientation={orientation}
            arePiecesDraggable={isPlayer && !gameOverData && isMyTurn}
            customBoardStyle={CHESS_BOARD_STYLE}
            customDarkSquareStyle={CHESS_DARK_SQUARE_STYLE}
            customLightSquareStyle={CHESS_LIGHT_SQUARE_STYLE}
            customSquareStyles={customSquareStyles}
          />
        </div>

        {/* Bottom Player (You) */}
        <div
          className={`p-3.5 sm:p-4 rounded-2xl border flex items-center justify-between gap-3 transition-[background-color,border-color,box-shadow] duration-150 ${
            isBottomInCheck && !gameOverData
              ? 'bg-rose-50/70 border-rose-400 shadow-card ring-1 ring-rose-300'
              : isBottomPlayerTurn
              ? 'bg-sky-50/90 border-sky-400 shadow-card ring-1 ring-sky-300'
              : 'bg-white border-slate-200/80 shadow-subtle'
          }`}
        >
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-10 h-10 shrink-0 rounded-xl bg-slate-100 flex items-center justify-center border border-slate-200 shadow-sm">
              <PieceSvg type="k" color={orientation === 'white' ? 'w' : 'b'} className="w-6 h-6" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-bold text-slate-900 text-sm flex flex-wrap items-center gap-2">
                <span className="truncate">
                  {orientation === 'white'
                    ? gameState?.whitePlayerName || user?.username || 'Bạn'
                    : gameState?.blackPlayerName || user?.username || 'Bạn'}
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200/70 font-semibold">
                  Bạn
                </span>
                {isBottomInCheck && !gameOverData && (
                  <span className="flex items-center gap-1 text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full animate-pulse">
                    <ShieldAlert className="w-3.5 h-3.5" />
                    Bạn đang bị chiếu!
                  </span>
                )}
              </div>
              <div className="text-xs text-slate-500 font-mono tabular-nums">
                ELO:{' '}
                {orientation === 'white'
                  ? gameState?.whitePlayerRating || user?.eloRating || 1200
                  : gameState?.blackPlayerRating || user?.eloRating || 1200}
              </div>
            </div>
          </div>

          {/* Clock */}
          <PlayerClock
            syncedMs={bottomClockMs}
            syncTimestamp={clockSync.timestamp}
            isRunning={!!isBottomPlayerTurn && gameState?.status === 'IN_PROGRESS' && !gameOverData}
            isActive={!!isBottomPlayerTurn}
            onTimeout={isPlayer ? handleClaimTimeout : undefined}
          />
        </div>

        {/* Controls Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setOrientation((prev) => (prev === 'white' ? 'black' : 'white'))}
              aria-label="Xoay hướng bàn cờ"
              className="px-3 sm:px-3.5 py-2 min-h-[44px] min-w-[44px] bg-white hover:bg-slate-50 border border-slate-200/90 text-slate-700 text-xs font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors shadow-subtle active:scale-[0.98]"
            >
              <RotateCcw className="w-4 h-4 text-sky-600" />
              <span className="hidden sm:inline">Xoay bàn cờ</span>
            </button>

            <button
              type="button"
              onClick={() => setShowHints((prev) => !prev)}
              aria-label={showHints ? 'Tắt gợi ý nước đi hợp lệ' : 'Bật gợi ý nước đi hợp lệ'}
              aria-pressed={showHints}
              title="Bật/tắt chấm gợi ý nước đi"
              className={`px-3 py-2 min-h-[44px] min-w-[44px] border text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-colors shadow-subtle active:scale-[0.98] ${
                showHints
                  ? 'bg-sky-50 border-sky-300 text-sky-800'
                  : 'bg-white border-slate-200/90 text-slate-500 hover:bg-slate-50'
              }`}
            >
              <Lightbulb
                className={`w-4 h-4 ${showHints ? 'text-amber-500 fill-amber-500' : 'text-slate-500'}`}
              />
              <span className="hidden sm:inline">Gợi ý {showHints ? 'Bật' : 'Tắt'}</span>
            </button>

            <button
              type="button"
              onClick={toggleSound}
              aria-label={soundEnabled ? 'Tắt âm thanh ván đấu' : 'Bật âm thanh ván đấu'}
              title="Âm thanh"
              className={`px-3 py-2 min-h-[44px] min-w-[44px] border text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-colors shadow-subtle active:scale-[0.98] ${
                soundEnabled
                  ? 'bg-sky-50 border-sky-300 text-sky-800'
                  : 'bg-white border-slate-200/90 text-slate-500 hover:bg-slate-50'
              }`}
            >
              {soundEnabled ? (
                <Volume2 className="w-4 h-4 text-sky-600" />
              ) : (
                <VolumeX className="w-4 h-4 text-slate-500" />
              )}
              <span className="hidden sm:inline">Âm thanh</span>
            </button>
          </div>

          {isPlayer && !gameOverData && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={drawOfferSent}
                onClick={handleOfferDraw}
                className="px-3.5 py-2 min-h-[44px] min-w-[44px] bg-white hover:bg-amber-50 border border-slate-200/90 hover:border-amber-300 text-slate-700 hover:text-amber-700 disabled:opacity-60 disabled:pointer-events-none text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-colors shadow-subtle active:scale-[0.98]"
              >
                <Handshake className="w-4 h-4 text-amber-500" />
                <span>{drawOfferSent ? 'Đã gửi hòa' : 'Cầu hòa'}</span>
              </button>
              <button
                type="button"
                onClick={() => setShowResignModal(true)}
                className="px-3.5 py-2 min-h-[44px] min-w-[44px] bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-colors shadow-subtle active:scale-[0.98]"
              >
                <Flag className="w-4 h-4 text-rose-500" />
                <span>Đầu hàng</span>
              </button>
            </div>
          )}
        </div>

        {statusNotice && (
          <div
            role={statusNotice.type === 'error' ? 'alert' : 'status'}
            aria-live="polite"
            className={`px-3.5 py-2.5 rounded-xl border text-xs font-medium flex items-center justify-between gap-3 animate-in fade-in duration-150 ${
              statusNotice.type === 'error'
                ? 'bg-rose-50 border-rose-200 text-rose-700'
                : 'bg-sky-50 border-sky-200 text-sky-800'
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              {statusNotice.type === 'error' ? (
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" aria-hidden="true" />
              ) : (
                <Handshake className="w-4 h-4 shrink-0 text-sky-700" aria-hidden="true" />
              )}
              <span>{statusNotice.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setStatusNotice(null)}
              aria-label="Đóng thông báo"
              className="min-h-[44px] min-w-[44px] sm:min-h-[32px] sm:min-w-[32px] shrink-0 flex items-center justify-center rounded-lg hover:bg-black/5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Right: Move History & In-Game Chat Panel */}
      <div className="w-full lg:w-96 min-w-0 flex flex-col gap-4 self-stretch">
        {/* Move History */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 flex flex-col h-64 shadow-card">
          <div className="text-xs font-bold text-slate-600 pb-3 border-b border-slate-100 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <History className="w-3.5 h-3.5 text-sky-600" />
              Nước Đi Trận Đấu
            </span>
            <span className="font-mono tabular-nums text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-bold">
              {gameState?.moves?.length || 0}
            </span>
          </div>
          <div ref={moveHistoryContainerRef} className="flex-1 overflow-y-auto mt-2 space-y-1 text-sm font-mono tabular-nums pr-2">
            {gameState?.moves && gameState.moves.length > 0 ? (
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                {gameState.moves.map((m, idx) => (
                  <div
                    key={idx}
                    className={`px-2 py-1 rounded-lg transition-colors ${
                      idx === gameState.moves.length - 1
                        ? 'bg-sky-50 text-sky-700 font-bold border border-sky-200/60'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {m.ply % 2 !== 0 && (
                      <span className="text-slate-600 mr-2 font-medium">{Math.ceil(m.ply / 2)}.</span>
                    )}
                    <span>{m.san}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-600 text-center py-8 font-medium">Chưa có nước đi nào</p>
            )}
          </div>
        </div>

        {/* Chat Panel */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 flex-1 flex flex-col shadow-card min-h-[350px]">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-600 pb-3 border-b border-slate-100">
            <MessageSquare className="w-4 h-4 text-sky-600" />
            <span>Trò Chuyện Trong Trận</span>
          </div>

          <div
            ref={chatContainerRef}
            role="log"
            aria-live="polite"
            aria-relevant="additions"
            aria-label="Tin nhắn trò chuyện trong trận"
            className="flex-1 overflow-y-auto my-3 space-y-2.5 text-xs pr-1"
          >
            {chatMessages.length === 0 ? (
              <p className="text-center text-slate-600 py-8 font-medium">Gửi lời chào tới đối thủ...</p>
            ) : (
              chatMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`p-2.5 rounded-xl max-w-[85%] ${
                    msg.senderId === user?.id
                      ? 'ml-auto bg-sky-700 text-white rounded-br-none shadow-subtle'
                      : 'bg-slate-100 text-slate-800 rounded-bl-none border border-slate-200/60'
                  }`}
                >
                  <div
                    className={`font-semibold text-xs mb-0.5 ${
                      msg.senderId === user?.id ? 'text-sky-100' : 'text-slate-500'
                    }`}
                  >
                    {msg.senderUsername}
                  </div>
                  <div>{msg.content}</div>
                </div>
              ))
            )}
          </div>

          <form onSubmit={handleSendMessage} className="flex gap-2 pt-2 border-t border-slate-100">
            <label htmlFor="game-chat-input" className="sr-only">
              Nhập tin nhắn trò chuyện trong trận
            </label>
            <input
              id="game-chat-input"
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder="Nhập tin nhắn..."
              maxLength={500}
              className="flex-1 min-w-0 min-h-[44px] px-3 py-2 bg-slate-50 border border-slate-200/90 rounded-xl text-base sm:text-sm text-slate-800 placeholder-slate-500 focus:outline-none focus:border-sky-500 focus:bg-white focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-1 transition-colors"
            />
            <button
              type="submit"
              aria-label="Gửi tin nhắn"
              className="min-h-[44px] min-w-[44px] flex items-center justify-center bg-sky-700 hover:bg-sky-800 active:scale-[0.98] text-white rounded-xl shadow-sm transition-colors focus-visible:ring-2 focus-visible:ring-sky-500"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      </div>

      {/* Incoming Draw Offer Modal */}
      {incomingDrawOffer && (
        <div className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div
            ref={drawModalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="draw-dialog-title"
            className="bg-white border border-slate-200 rounded-2xl max-w-sm w-full max-h-[90dvh] overflow-y-auto p-6 text-center shadow-modal animate-in fade-in zoom-in-95 duration-150"
          >
            <Handshake className="w-12 h-12 text-amber-500 mx-auto mb-3" />
            <h2 id="draw-dialog-title" className="text-lg font-bold text-slate-900 mb-2">Đối Thủ Đề Nghị Hòa</h2>
            <p className="text-xs text-slate-500 mb-6 leading-relaxed">
              Kỳ thủ <strong className="text-slate-800">{incomingDrawOffer}</strong> muốn kết thúc trận đấu với kết quả hòa. Bạn có đồng ý không?
            </p>
            <div className="flex flex-col-reverse sm:flex-row gap-2.5 sm:gap-3">
              <button
                onClick={handleRejectDraw}
                className="flex-1 py-2.5 min-h-[44px] bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors"
              >
                Từ Chối
              </button>
              <button
                onClick={handleAcceptDraw}
                className="flex-1 py-2.5 min-h-[44px] bg-amber-700 hover:bg-amber-800 text-white font-bold rounded-xl text-xs transition-colors shadow-sm"
              >
                Chấp Nhận Hòa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Resign Confirmation Modal */}
      {showResignModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div
            ref={resignModalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="resign-dialog-title"
            aria-describedby="resign-dialog-desc"
            className="bg-white border border-slate-200 rounded-2xl max-w-sm w-full max-h-[90dvh] overflow-y-auto p-6 text-center shadow-modal animate-in fade-in zoom-in-95 duration-150"
          >
            <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-3" />
            <h2 id="resign-dialog-title" className="text-lg font-bold text-slate-900 mb-2">
              Đầu hàng ván đấu này?
            </h2>
            <p id="resign-dialog-desc" className="text-xs text-slate-600 mb-6 leading-relaxed">
              Ván cờ sẽ kết thúc ngay với phần thắng thuộc về đối thủ và hệ số ELO của bạn sẽ được cập nhật.
            </p>
            <div className="flex flex-col-reverse sm:flex-row gap-2.5 sm:gap-3">
              <button
                type="button"
                onClick={() => setShowResignModal(false)}
                className="flex-1 py-2.5 min-h-[44px] bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors"
              >
                Tiếp tục chơi
              </button>
              <button
                type="button"
                onClick={handleResign}
                className="flex-1 py-2.5 min-h-[44px] bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs transition-colors shadow-sm"
              >
                Đầu hàng ván này
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Game Over Modal */}
      {gameOverData && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div
            ref={gameOverModalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="gameover-dialog-title"
            className="bg-white border border-slate-200 rounded-3xl max-w-md w-full max-h-[90dvh] overflow-y-auto p-6 sm:p-8 text-center shadow-modal animate-in fade-in zoom-in-95 duration-200"
          >
            <div className="w-16 h-16 bg-sky-50 border border-sky-200 rounded-2xl mx-auto flex items-center justify-center mb-4">
              <Trophy className="w-8 h-8 text-sky-600" />
            </div>

            <h2 id="gameover-dialog-title" className="text-2xl font-extrabold text-slate-900 mb-1 tracking-tight">
              Trận Đấu Kết Thúc
            </h2>
            <div className="text-lg font-bold text-sky-700 mb-1">
              {gameOverData.result === 'WHITE_WON'
                ? 'Quân Trắng Thắng!'
                : gameOverData.result === 'BLACK_WON'
                ? 'Quân Đen Thắng!'
                : 'Trận Đấu Hòa!'}
            </div>
            <p className="text-xs text-slate-600 mb-6 font-semibold">
              Lý do: {gameOverData.terminationReason}
            </p>

            {/* ELO Changes display */}
            {gameOverData.whiteEloChange !== undefined && (
              <div className="bg-slate-50 rounded-2xl p-4 mb-6 border border-slate-200/80 grid grid-cols-2 gap-4 text-xs font-mono tabular-nums">
                <div>
                  <div className="text-slate-500 mb-1 font-sans">Quân Trắng</div>
                  <div className="font-bold text-slate-900 text-sm">
                    {gameOverData.newWhiteElo} ELO
                  </div>
                  <div
                    className={`font-semibold ${
                      gameOverData.whiteEloChange >= 0 ? 'text-emerald-700' : 'text-rose-700'
                    }`}
                  >
                    {gameOverData.whiteEloChange >= 0 ? '+' : ''}
                    {gameOverData.whiteEloChange}
                  </div>
                </div>
                <div>
                  <div className="text-slate-500 mb-1 font-sans">Quân Đen</div>
                  <div className="font-bold text-slate-900 text-sm">
                    {gameOverData.newBlackElo} ELO
                  </div>
                  <div
                    className={`font-semibold ${
                      gameOverData.blackEloChange !== undefined && gameOverData.blackEloChange >= 0
                        ? 'text-emerald-700'
                        : 'text-rose-700'
                    }`}
                  >
                    {gameOverData.blackEloChange !== undefined && gameOverData.blackEloChange >= 0
                      ? '+'
                      : ''}
                    {gameOverData.blackEloChange}
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => navigate(`/history?replay=${gameId}`)}
                className="flex-1 py-2.5 min-h-[44px] bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-sm transition-colors"
              >
                Xem Lại Trận
              </button>
              <button
                onClick={() => navigate('/lobby')}
                className="flex-1 py-2.5 min-h-[44px] bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-sm shadow-sm transition-colors active:scale-[0.98]"
              >
                Về Sảnh Chờ
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Pawn Promotion Modal */}
      <PromotionModal
        isOpen={!!pendingPromotion}
        color={pendingPromotion?.color || 'w'}
        onSelect={handlePromotionSelect}
        onCancel={() => {
          setPendingPromotion(null);
          if (gameState) {
            setBoardFen(gameState.currentFen);
            localChessRef.current = new Chess(gameState.currentFen);
          }
        }}
      />
    </div>
  );
}
