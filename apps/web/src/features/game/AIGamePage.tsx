import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Chessboard } from 'react-chessboard';
import { Chess, Square } from 'chess.js';
import { fireConfetti } from '../../lib/confetti';
import { api } from '../../services/api';
import { useAuthStore } from '../../stores/authStore';
import { soundManager } from '../../lib/sound';
import { useDialogFocusTrap } from '../../hooks/useDialogFocusTrap';
import { findKingSquare } from '../../lib/chessUtils';
import {
  GameState,
  AIDifficulty,
  TIME_CONTROLS,
  AISearchStats,
  AI_SYSTEM_USER_ID,
} from '@online-chess/shared';

const isAiPlayer = (id?: string | null) => id === 'ai-engine' || id === AI_SYSTEM_USER_ID;

function getCapturedStats(chess: Chess) {
  const initialCounts: Record<string, number> = { p: 8, n: 2, b: 2, r: 2, q: 1 };
  const currentW: Record<string, number> = { p: 0, n: 0, b: 0, r: 0, q: 0 };
  const currentB: Record<string, number> = { p: 0, n: 0, b: 0, r: 0, q: 0 };

  const board = chess.board();
  for (const row of board) {
    for (const piece of row) {
      if (piece && piece.type !== 'k') {
        if (piece.color === 'w') currentW[piece.type]++;
        else currentB[piece.type]++;
      }
    }
  }

  const whiteCaptured: { type: string; count: number }[] = [];
  const blackCaptured: { type: string; count: number }[] = [];

  const pieceValues: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9 };
  let whiteMat = 0;
  let blackMat = 0;

  for (const [type, init] of Object.entries(initialCounts)) {
    const lostByWhite = Math.max(0, init - currentW[type]);
    const lostByBlack = Math.max(0, init - currentB[type]);
    if (lostByWhite > 0) whiteCaptured.push({ type, count: lostByWhite });
    if (lostByBlack > 0) blackCaptured.push({ type, count: lostByBlack });
    whiteMat += currentW[type] * pieceValues[type];
    blackMat += currentB[type] * pieceValues[type];
  }

  return {
    whiteCaptured,
    blackCaptured,
    materialAdvantage: whiteMat - blackMat,
  };
}

import {
  RotateCcw,
  RotateCw,
  Trophy,
  Play,
  Lightbulb,
  Volume2,
  VolumeX,
  Flag,
  ShieldAlert,
  X,
  Swords,
  BookOpen,
  Compass,
  Bot,
  User,
  SlidersHorizontal,
  AlertCircle,
} from 'lucide-react';
import { PromotionModal } from './components/PromotionModal';
import { PlayerClock } from './components/PlayerClock';
import { PieceSvg } from '../../components/chess/PieceSvg';
import {
  CHESS_BOARD_STYLE_ROUNDED,
  CHESS_DARK_SQUARE_STYLE,
  CHESS_LIGHT_SQUARE_STYLE,
  buildSquareHighlightStyles,
} from '../../lib/boardTheme';
export { PieceSvg };

export default function AIGamePage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  // Game Setup Configuration
  const [difficulty, setDifficulty] = useState<AIDifficulty>('MEDIUM');
  const [selectedTimeKey, setSelectedTimeKey] = useState<keyof typeof TIME_CONTROLS>('RAPID_10');
  const [playerColor, setPlayerColor] = useState<'white' | 'black' | 'random'>('white');
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [isStartingGame, setIsStartingGame] = useState(false);
  const [startError, setStartError] = useState('');
  const [aiMoveError, setAiMoveError] = useState('');
  const [showResignModal, setShowResignModal] = useState(false);
  const [isResigning, setIsResigning] = useState(false);

  // Game Play State
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [boardFen, setBoardFen] = useState('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
  const [orientation, setOrientation] = useState<'white' | 'black'>('white');
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [aiStats, setAiStats] = useState<AISearchStats | null>(null);
  const [gameOverResult, setGameOverResult] = useState<string | null>(null);
  const [moveHistory, setMoveHistory] = useState<{ ply: number; san: string; from: string; to: string }[]>([]);

  // Legal moves & Selection state
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [possibleMoves, setPossibleMoves] = useState<string[]>([]);
  const [captureMoves, setCaptureMoves] = useState<Set<string>>(new Set());
  const [lastMoveSquares, setLastMoveSquares] = useState<{ from?: string; to?: string }>({});
  const [isCheck, setIsCheck] = useState(false);
  const [pendingPromotion, setPendingPromotion] = useState<{
    from: string;
    to: string;
    color: 'w' | 'b';
  } | null>(null);

  // User Settings
  const [showHints, setShowHints] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(soundManager.isEnabled());

  // Local AI/Human clocks (countdown isolated inside PlayerClock)
  const [clockResetConfig, setClockResetConfig] = useState({
    initialMs: 600000,
    resetId: 0,
  });

  const localChessRef = useRef(new Chess());
  const moveHistoryContainerRef = useRef<HTMLDivElement>(null);
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

  // Sound Effects via SoundManager
  const playSound = useCallback((type: 'move' | 'capture' | 'check' | 'gameover') => {
    soundManager.play(type);
  }, []);

  const toggleSound = () => {
    const newVal = soundManager.toggle();
    setSoundEnabled(newVal);
  };

  // Auto-scroll move history container internally without scrolling the page
  useEffect(() => {
    if (moveHistoryContainerRef.current) {
      moveHistoryContainerRef.current.scrollTop = moveHistoryContainerRef.current.scrollHeight;
    }
  }, [moveHistory]);

  const capturedStats = useMemo(() => getCapturedStats(localChessRef.current), [boardFen]);

  const renderCapturedPieces = (
    pieces: { type: string; count: number }[],
    pieceColor: 'w' | 'b'
  ) => {
    if (pieces.length === 0) return null;
    return (
      <div className="flex items-center gap-1 flex-wrap">
        {pieces.map((c) => (
          <span
            key={c.type}
            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200/80 shadow-subtle"
            title={`${c.count} ${c.type.toUpperCase()}`}
          >
            <PieceSvg type={c.type} color={pieceColor} className="w-3.5 h-3.5" />
            {c.count > 1 && (
              <span className="text-xs font-bold font-mono tabular-nums text-slate-600">
                ×{c.count}
              </span>
            )}
          </span>
        ))}
      </div>
    );
  };

  // Handle exiting game creation or closing setup modal
  const handleExitCreation = useCallback(() => {
    setStartError('');
    if (gameState) {
      setShowConfigModal(false);
    } else {
      navigate('/lobby');
    }
  }, [gameState, navigate]);

  const isSetupModalOpen = showConfigModal || !gameState;
  const configModalRef = useDialogFocusTrap<HTMLDivElement>({
    isOpen: isSetupModalOpen,
    onClose: handleExitCreation,
  });

  const resignModalRef = useDialogFocusTrap<HTMLDivElement>({
    isOpen: showResignModal,
    onClose: () => {
      if (!isResigning) setShowResignModal(false);
    },
  });

  // Initialize or Restart Game
  const handleStartGame = async () => {
    if (isStartingGame) return;
    setStartError('');
    setAiMoveError('');
    setIsStartingGame(true);
    try {
      const tc = TIME_CONTROLS[selectedTimeKey];
      const res = await api.post('/ai/game', {
        difficulty,
        initialTimeMs: tc.initialTimeMs,
        incrementMs: tc.incrementMs,
        playerColor,
      });

      if (res.data.success && res.data.data) {
        setShowConfigModal(false);
        setGameOverResult(null);
        setAiStats(null);
        clearSelection();
        setLastMoveSquares({});
        setMoveHistory([]);
        setClockResetConfig((prev) => ({
          initialMs: tc.initialTimeMs,
          resetId: prev.resetId + 1,
        }));

        const game: GameState = res.data.data;
        setGameState(game);
        setBoardFen(game.currentFen);
        localChessRef.current = new Chess(game.currentFen);

        const isHumanWhite = !isAiPlayer(game.whitePlayerId);
        setOrientation(isHumanWhite ? 'white' : 'black');
        setIsCheck(localChessRef.current.inCheck());

        if (game.moves && game.moves.length > 0) {
          setMoveHistory(
            game.moves.map((m: any) => ({
              ply: m.ply,
              san: m.san,
              from: m.fromSquare,
              to: m.toSquare,
            }))
          );
          const lastM = game.moves[game.moves.length - 1];
          setLastMoveSquares({ from: lastM.fromSquare, to: lastM.toSquare });
          playSound(lastM.san.includes('x') ? 'capture' : 'move');
        }
      } else {
        setStartError('Không thể khởi tạo ván đấu với máy. Vui lòng thử lại.');
      }
    } catch (err: any) {
      setStartError(
        err.response?.data?.message ||
          'Không thể khởi tạo ván đấu với máy. Kiểm tra kết nối và thử lại.'
      );
    } finally {
      setIsStartingGame(false);
    }
  };

  // Trigger AI to make a move
  const triggerAiResponse = async (gameId: string) => {
    setAiMoveError('');
    setIsAiThinking(true);
    try {
      const res = await api.post('/ai/move', { gameId });
      if (res.data.success && res.data.data) {
        const moveRes = res.data.data;
        setBoardFen(moveRes.fen);
        localChessRef.current = new Chess(moveRes.fen);
        setAiStats(res.data.stats);

        const aiCheck = localChessRef.current.inCheck();
        setIsCheck(aiCheck);

        // Update last move highlight
        if (moveRes.move) {
          setLastMoveSquares({ from: moveRes.move.fromSquare, to: moveRes.move.toSquare });
          setMoveHistory((prev) => [
            ...prev,
            {
              ply: moveRes.move.ply,
              san: moveRes.move.san,
              from: moveRes.move.fromSquare,
              to: moveRes.move.toSquare,
            },
          ]);
        }

        // Sound effect
        if (moveRes.isGameOver) {
          playSound('gameover');
        } else if (aiCheck) {
          playSound('check');
        } else if (moveRes.move?.san?.includes('x')) {
          playSound('capture');
        } else {
          playSound('move');
        }

        setGameState((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            currentFen: moveRes.fen,
            currentTurn: moveRes.currentTurn,
            positionVersion: moveRes.positionVersion,
            isCheck: moveRes.isCheck,
            moves: [...prev.moves, moveRes.move],
          };
        });

        if (moveRes.isGameOver) {
          const resultStr =
            moveRes.result === 'WHITE_WON'
              ? 'Trắng thắng!'
              : moveRes.result === 'BLACK_WON'
              ? 'Đen thắng!'
              : 'Trận đấu hòa!';
          setGameOverResult(`${resultStr} (${moveRes.terminationReason})`);
          if (
            (moveRes.result === 'WHITE_WON' && orientation === 'white') ||
            (moveRes.result === 'BLACK_WON' && orientation === 'black')
          ) {
            fireConfetti({ particleCount: 90, spread: 70 });
          }
        }
      }
    } catch (err: any) {
      console.error('AI move error', err);
      setAiMoveError(
        err.response?.data?.message ||
          'Máy chưa thể phản hồi nước đi lúc này. Hãy thử lại lượt máy.'
      );
    } finally {
      setIsAiThinking(false);
    }
  };

  // Perform Human Move
  const executeMove = useCallback(
    (sourceSquare: string, targetSquare: string, promotion: string = 'q'): boolean => {
      if (!gameState || gameState.status !== 'IN_PROGRESS' || isAiThinking || gameOverResult) {
        return false;
      }

      const isHumanWhite = !isAiPlayer(gameState.whitePlayerId);
      const isHumanTurn =
        (gameState.currentTurn === 'w' && isHumanWhite) ||
        (gameState.currentTurn === 'b' && !isHumanWhite);

      if (!isHumanTurn) return false;

      // Validate on local chess instance
      const localChess = localChessRef.current;
      const testMove = localChess.move({
        from: sourceSquare as Square,
        to: targetSquare as Square,
        promotion,
      });

      if (!testMove) return false;
      localChess.undo();

      // Sound
      if (testMove.captured) playSound('capture');
      else playSound('move');

      // Optimistic local state update
      setSelectedSquare(null);
      setPossibleMoves([]);
      setCaptureMoves(new Set());
      setLastMoveSquares({ from: sourceSquare, to: targetSquare });

      // Call API
      api
        .post(`/games/${gameState.id}/move`, {
          from: sourceSquare,
          to: targetSquare,
          promotion,
          expectedVersion: gameState.positionVersion,
        })
        .then((res) => {
          if (res.data.success) {
            const moveRes = res.data.data;
            setBoardFen(moveRes.fen);
            localChessRef.current = new Chess(moveRes.fen);
            setIsCheck(localChessRef.current.inCheck());

            if (moveRes.move) {
              setMoveHistory((prev) => [
                ...prev,
                {
                  ply: moveRes.move.ply,
                  san: moveRes.move.san,
                  from: moveRes.move.fromSquare,
                  to: moveRes.move.toSquare,
                },
              ]);
            }

            setGameState((prev) => {
              if (!prev) return prev;
              return {
                ...prev,
                currentFen: moveRes.fen,
                currentTurn: moveRes.currentTurn,
                positionVersion: moveRes.positionVersion,
                isCheck: moveRes.isCheck,
                moves: [...prev.moves, moveRes.move],
              };
            });

            if (moveRes.isGameOver) {
              playSound('gameover');
              const resultStr =
                moveRes.result === 'WHITE_WON'
                  ? 'Trắng thắng!'
                  : moveRes.result === 'BLACK_WON'
                  ? 'Đen thắng!'
                  : 'Hòa!';
              setGameOverResult(`${resultStr} (${moveRes.terminationReason})`);
              if (
                (moveRes.result === 'WHITE_WON' && isHumanWhite) ||
                (moveRes.result === 'BLACK_WON' && !isHumanWhite)
              ) {
                fireConfetti({ particleCount: 100, spread: 80 });
              }
            } else {
              triggerAiResponse(gameState.id);
            }
          }
        })
        .catch(() => {
          setBoardFen(gameState.currentFen);
          localChessRef.current = new Chess(gameState.currentFen);
        });

      return true;
    },
    [gameState, isAiThinking, gameOverResult, orientation, playSound]
  );

  // Square Click handler (Click-to-Move + Legal moves calculation)
  const handleSquareClick = (square: Square) => {
    if (!gameState || gameState.status !== 'IN_PROGRESS' || isAiThinking || gameOverResult) {
      return;
    }

    const isHumanWhite = !isAiPlayer(gameState.whitePlayerId);
    const isHumanTurn =
      (gameState.currentTurn === 'w' && isHumanWhite) ||
      (gameState.currentTurn === 'b' && !isHumanWhite);

    if (!isHumanTurn) return;

    // If a piece is already selected and target square is a legal destination -> Move!
    if (selectedSquare && possibleMoves.includes(square)) {
      const piece = localChessRef.current.get(selectedSquare as Square);
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

      executeMove(selectedSquare, square, 'q');
      return;
    }

    // Check if the clicked square contains a piece belonging to the human player
    const piece = localChessRef.current.get(square);
    const humanColor = isHumanWhite ? 'w' : 'b';

    if (piece && piece.color === humanColor) {
      setSelectedSquare(square);
      const moves = localChessRef.current.moves({ square, verbose: true });
      const targets = moves.map((m) => m.to);
      const captures = new Set(moves.filter((m) => !!m.captured).map((m) => m.to));
      setPossibleMoves(targets);
      setCaptureMoves(captures);
    } else {
      // Clicked on an invalid square or empty square -> Deselect
      setSelectedSquare(null);
      setPossibleMoves([]);
      setCaptureMoves(new Set());
    }
  };

  // Drag begin handler
  const handlePieceDragBegin = (_piece: string, sourceSquare: Square) => {
    if (!gameState || gameState.status !== 'IN_PROGRESS' || isAiThinking || gameOverResult) {
      return;
    }

    const isHumanWhite = !isAiPlayer(gameState.whitePlayerId);
    const humanColor = isHumanWhite ? 'w' : 'b';
    const pieceObj = localChessRef.current.get(sourceSquare);

    if (pieceObj && pieceObj.color === humanColor) {
      isDraggingPieceRef.current = true;
      setSelectedSquare(sourceSquare);
      const moves = localChessRef.current.moves({ square: sourceSquare, verbose: true });
      setPossibleMoves(moves.map((m) => m.to));
      setCaptureMoves(new Set(moves.filter((m) => !!m.captured).map((m) => m.to)));
    }
  };

  const handlePieceDragEnd = useCallback(() => {
    clearSelection();
  }, [clearSelection]);

  // Drag drop handler
  const handlePieceDrop = (sourceSquare: Square, targetSquare: Square) => {
    clearSelection();

    const piece = localChessRef.current.get(sourceSquare);
    const isPawnPromotion =
      piece &&
      piece.type === 'p' &&
      ((piece.color === 'w' && targetSquare.endsWith('8')) ||
        (piece.color === 'b' && targetSquare.endsWith('1')));

    if (isPawnPromotion) {
      setPendingPromotion({ from: sourceSquare, to: targetSquare, color: piece.color });
      return false;
    }

    return executeMove(sourceSquare, targetSquare, 'q');
  };

  const handlePromotionSelect = (promPiece: 'q' | 'r' | 'b' | 'n') => {
    if (!pendingPromotion) return;
    const { from, to } = pendingPromotion;
    setPendingPromotion(null);
    executeMove(from, to, promPiece);
  };

  // Resign match
  const handleConfirmResign = async () => {
    if (!gameState || gameState.status !== 'IN_PROGRESS' || isResigning) return;
    setIsResigning(true);
    const isHumanWhite = !isAiPlayer(gameState.whitePlayerId);
    const winner = isHumanWhite ? 'Máy (Quân Đen)' : 'Máy (Quân Trắng)';
    setGameOverResult(`${winner} thắng (Bạn đầu hàng)`);
    setShowResignModal(false);
    playSound('gameover');
    try {
      await api.post(`/games/${gameState.id}/resign`);
    } catch {
    } finally {
      setIsResigning(false);
    }
  };

  // Memoize custom square styles for hints, selection, last move, check
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

  // Whose turn is it right now?
  const isHumanTurn =
    gameState &&
    gameState.status === 'IN_PROGRESS' &&
    ((gameState.currentTurn === 'w' && !isAiPlayer(gameState.whitePlayerId)) ||
      (gameState.currentTurn === 'b' && !isAiPlayer(gameState.blackPlayerId)));

  const aiTurnColor = orientation === 'white' ? 'b' : 'w';
  const humanTurnColor = orientation === 'white' ? 'w' : 'b';
  const currentTurn = localChessRef.current.turn();
  const aiInCheck = isCheck && currentTurn === aiTurnColor;
  const humanInCheck = isCheck && currentTurn === humanTurnColor;

  // Evaluation centipawns conversion
  const evalPawns = aiStats ? (aiStats.score / 100).toFixed(1) : '0.0';

  // Human-friendly game assessment message
  const getGameAssessment = () => {
    if (!aiStats) return 'Ván cờ vừa bắt đầu, chưa có đánh giá thế trận.';
    const score = aiStats.score;
    const isHumanWhite = !isAiPlayer(gameState?.whitePlayerId);
    const humanScore = isHumanWhite ? score : -score;

    if (Math.abs(score) < 50) return '⚖️ Thế trận đang giằng co rất cân bằng!';
    if (humanScore > 150) return '🌟 Bạn đang chiếm ưu thế rõ rệt, hãy duy trì nhịp độ!';
    if (humanScore > 50) return '📈 Bạn đang có chút lợi thế nhỏ về vị trí hoặc quân số.';
    if (humanScore < -150) return '🛡️ Máy đang tạo áp lực mạnh, hãy cẩn trọng bảo vệ Vua!';
    return '⚔️ Máy đang dẫn trước một chút, cơ hội phản công vẫn còn!';
  };

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-4 py-3 flex-1 flex flex-col gap-3.5">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <span>Luyện Tập Với Máy</span>
            </h1>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200/70">
              {difficulty === 'EASY' ? 'Bot Tập sự' : difficulty === 'MEDIUM' ? 'Bot Kỳ thủ' : 'Bot Cao thủ'}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Luyện tập cờ vua cùng máy thông minh — hỗ trợ gợi ý nước đi và nhận định thế trận
          </p>
        </div>

        {/* Live Status Pill & Action button */}
        <div className="flex flex-wrap items-center gap-2">
          <div aria-live="polite" aria-atomic="true" className="flex flex-wrap items-center gap-2">
            {isCheck && !gameOverResult && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-rose-50 text-rose-700 font-semibold text-xs border border-rose-200 animate-pulse">
                <ShieldAlert className="w-3.5 h-3.5" />
                Chiếu tướng!
              </div>
            )}

            {isAiThinking ? (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-50 text-indigo-700 text-xs font-medium border border-indigo-200">
                <div className="w-3 h-3 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                Máy đang suy nghĩ...
              </div>
            ) : isHumanTurn && !gameOverResult ? (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-medium border border-emerald-200">
                <span className="w-2 h-2 rounded-full bg-emerald-500" aria-hidden="true" />
                Đến lượt bạn
              </div>
            ) : gameOverResult ? (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-50 text-amber-800 text-xs font-semibold border border-amber-200">
                <Trophy className="w-3.5 h-3.5 text-amber-600" />
                {gameOverResult}
              </div>
            ) : null}
          </div>

          <button
            type="button"
            onClick={() => {
              setStartError('');
              setShowConfigModal(true);
            }}
            aria-label="Bắt đầu ván cờ mới với máy AI"
            title="Bắt đầu ván mới"
            className="px-3.5 py-2 sm:py-1.5 min-h-[44px] sm:min-h-[38px] bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-xl shadow-sm transition-colors flex items-center gap-1.5 active:scale-[0.96] focus-visible:ring-2 focus-visible:ring-sky-500"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Ván mới
          </button>

          <button
            type="button"
            onClick={() => navigate('/lobby')}
            aria-label="Rời ván đấu và về sảnh"
            className="px-3 py-2 sm:py-1.5 min-h-[44px] sm:min-h-[38px] text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200 text-xs font-semibold rounded-xl transition-colors flex items-center gap-1.5 active:scale-[0.96] focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:outline-none"
          >
            <X className="w-3.5 h-3.5" />
            <span>Rời ván</span>
          </button>
        </div>
      </div>

      {aiMoveError && gameState && !gameOverResult && (
        <div
          role="alert"
          className="px-3.5 py-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex flex-wrap items-center justify-between gap-3 animate-in fade-in duration-150"
        >
          <div className="flex items-center gap-2 min-w-0">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" aria-hidden="true" />
            <span>{aiMoveError}</span>
          </div>
          <button
            type="button"
            disabled={isAiThinking}
            onClick={() => triggerAiResponse(gameState.id)}
            className="px-3 py-1.5 min-h-[44px] sm:min-h-[34px] bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg text-xs transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
          >
            Thử lại lượt máy
          </button>
        </div>
      )}

      {/* Main Playing Area: 2 Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Column: Board & Player Info (7 cols) */}
        <div className="lg:col-span-7 min-w-0 flex flex-col gap-2 max-w-[550px] mx-auto w-full">
          {/* Opponent Card (AI) - Chess.com style */}
          <div
            className={`px-3.5 py-2.5 bg-white rounded-2xl flex items-center justify-between gap-2.5 transition-[background-color,border-color,box-shadow] duration-150 shadow-sm border ${
              aiInCheck && !gameOverResult
                ? 'border-rose-400 ring-2 ring-rose-100 bg-rose-50/40'
                : !isHumanTurn && !gameOverResult && gameState
                ? 'border-sky-300 ring-2 ring-sky-100'
                : 'border-slate-200/90'
            }`}
          >
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="relative shrink-0">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 border border-slate-300 flex items-center justify-center text-slate-700 shadow-sm">
                  <Bot className="w-5 h-5 text-sky-600" />
                </div>
                <span
                  className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white ring-1 ring-emerald-200"
                  title="Trực tuyến"
                />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-bold text-slate-900 text-sm flex flex-wrap items-center gap-2">
                  <span>
                    {difficulty === 'EASY'
                      ? 'Bot Tập Sự'
                      : difficulty === 'MEDIUM'
                      ? 'Bot Kỳ Thủ'
                      : 'Bot Cao Thủ'}
                  </span>
                  <span className="text-xs font-mono tabular-nums font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200/80">
                    {difficulty === 'EASY' ? '1000' : difficulty === 'MEDIUM' ? '1500' : '2000'}
                  </span>
                  {aiInCheck && !gameOverResult && (
                    <span className="flex items-center gap-1 text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full animate-pulse">
                      <ShieldAlert className="w-3.5 h-3.5" />
                      Chiếu tướng!
                    </span>
                  )}
                </div>
                {/* Captured pieces by AI */}
                <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-1 min-h-[18px]">
                  {renderCapturedPieces(
                    orientation === 'white'
                      ? capturedStats.whiteCaptured
                      : capturedStats.blackCaptured,
                    orientation === 'white' ? 'w' : 'b'
                  )}
                  {orientation === 'white' && capturedStats.materialAdvantage < 0 && (
                    <span className="font-bold text-slate-600 text-xs font-mono tabular-nums bg-slate-100 px-1 py-0.5 rounded border border-slate-200">
                      +{Math.abs(capturedStats.materialAdvantage)}
                    </span>
                  )}
                  {orientation === 'black' && capturedStats.materialAdvantage > 0 && (
                    <span className="font-bold text-slate-600 text-xs font-mono tabular-nums bg-slate-100 px-1 py-0.5 rounded border border-slate-200">
                      +{capturedStats.materialAdvantage}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* AI Clock */}
            <PlayerClock
              variant="ai"
              syncedMs={clockResetConfig.initialMs}
              resetKey={clockResetConfig.resetId}
              tickIntervalMs={1000}
              isRunning={gameState?.status === 'IN_PROGRESS' && !isHumanTurn && !gameOverResult}
              isActive={!isHumanTurn && !gameOverResult && !!gameState}
            />
          </div>

          {/* Interactive Chessboard Container */}
          <div
            onPointerCancel={clearSelection}
            onTouchCancel={clearSelection}
            className="w-full aspect-square bg-white p-2.5 sm:p-3 rounded-2xl shadow-sm border border-slate-200/90 relative board-touch-surface touch-none select-none"
          >
            <Chessboard
              position={boardFen}
              onPieceDrop={handlePieceDrop}
              onSquareClick={handleSquareClick}
              onPieceDragBegin={handlePieceDragBegin}
              onPieceDragEnd={handlePieceDragEnd}
              onPieceDropOffBoard={clearSelection}
              boardOrientation={orientation}
              arePiecesDraggable={!!gameState && !gameOverResult && !isAiThinking}
              customBoardStyle={CHESS_BOARD_STYLE_ROUNDED}
              customDarkSquareStyle={CHESS_DARK_SQUARE_STYLE}
              customLightSquareStyle={CHESS_LIGHT_SQUARE_STYLE}
              customSquareStyles={customSquareStyles}
            />

            {/* Game Over Celebration Overlay */}
            {gameOverResult && (
              <div className="absolute inset-2.5 sm:inset-3 bg-slate-900/40 backdrop-blur-sm rounded-xl flex items-center justify-center p-6 animate-in fade-in duration-200">
                <div className="bg-white rounded-2xl p-6 text-center max-w-sm w-full shadow-2xl border border-slate-100">
                  <div className="w-12 h-12 bg-amber-50 rounded-xl mx-auto flex items-center justify-center text-2xl mb-3">
                    🏆
                  </div>
                  <h2 className="text-xl font-bold text-slate-900 mb-1">Ván đấu đã kết thúc</h2>
                  <div className="text-sky-700 font-semibold text-sm mb-4">{gameOverResult}</div>
                  <button
                    type="button"
                    onClick={() => {
                      setStartError('');
                      setShowConfigModal(true);
                    }}
                    className="w-full py-2.5 min-h-[44px] bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-xl shadow-sm transition-colors"
                  >
                    Bắt đầu ván mới
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Player Card (You) - Chess.com style */}
          <div
            className={`px-3.5 py-2.5 bg-white rounded-2xl flex items-center justify-between gap-2.5 transition-[background-color,border-color,box-shadow] duration-150 shadow-sm border ${
              humanInCheck && !gameOverResult
                ? 'border-rose-400 ring-2 ring-rose-100 bg-rose-50/40'
                : isHumanTurn && !gameOverResult && gameState
                ? 'border-sky-300 ring-2 ring-sky-100'
                : 'border-slate-200/90'
            }`}
          >
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="relative shrink-0">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-sky-50 to-blue-100 border border-sky-200 flex items-center justify-center text-sky-700 shadow-sm">
                  <User className="w-5 h-5 text-sky-600" />
                </div>
                <span
                  className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white ring-1 ring-emerald-200"
                  title="Sẵn sàng"
                />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-bold text-slate-900 text-sm flex flex-wrap items-center gap-2">
                  <span className="truncate">{user?.displayName || user?.username || 'Bạn'}</span>
                  <span className="text-xs font-mono font-semibold px-1.5 py-0.5 rounded bg-sky-50 text-sky-700 border border-sky-200/80 tabular-nums">
                    {user?.eloRating || 1200}
                  </span>
                  <span className="text-xs text-slate-600 font-medium">
                    ({orientation === 'white' ? 'Trắng' : 'Đen'})
                  </span>
                  {humanInCheck && !gameOverResult && (
                    <span className="flex items-center gap-1 text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full animate-pulse">
                      <ShieldAlert className="w-3.5 h-3.5" />
                      Bạn đang bị chiếu!
                    </span>
                  )}
                </div>
                {/* Captured pieces by Human */}
                <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-1 min-h-[18px]">
                  {renderCapturedPieces(
                    orientation === 'white'
                      ? capturedStats.blackCaptured
                      : capturedStats.whiteCaptured,
                    orientation === 'white' ? 'b' : 'w'
                  )}
                  {orientation === 'white' && capturedStats.materialAdvantage > 0 && (
                    <span className="font-bold text-emerald-700 text-xs font-mono tabular-nums bg-emerald-50 px-1 py-0.5 rounded border border-emerald-200">
                      +{capturedStats.materialAdvantage}
                    </span>
                  )}
                  {orientation === 'black' && capturedStats.materialAdvantage < 0 && (
                    <span className="font-bold text-emerald-700 text-xs font-mono tabular-nums bg-emerald-50 px-1 py-0.5 rounded border border-emerald-200">
                      +{Math.abs(capturedStats.materialAdvantage)}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Human Clock */}
            <PlayerClock
              variant="ai"
              syncedMs={clockResetConfig.initialMs}
              resetKey={clockResetConfig.resetId}
              tickIntervalMs={1000}
              isRunning={!!isHumanTurn && !gameOverResult && !!gameState}
              isActive={!!isHumanTurn && !gameOverResult && !!gameState}
            />
          </div>

          {/* Chess.com style Action Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5 text-xs">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setOrientation((prev) => (prev === 'white' ? 'black' : 'white'))}
                aria-label={`Xoay hướng bàn cờ (hiện đang là quân ${orientation === 'white' ? 'Trắng' : 'Đen'} ở phía dưới)`}
                title="Xoay bàn cờ"
                className="p-2.5 sm:px-3 sm:py-1.5 min-h-[44px] min-w-[44px] bg-white hover:bg-slate-50 text-slate-700 font-medium rounded-xl border border-slate-200 shadow-sm flex items-center justify-center gap-1.5 transition-[color,background-color,border-color,transform] active:scale-95 focus-visible:ring-2 focus-visible:ring-sky-500"
              >
                <RotateCw className="w-3.5 h-3.5 text-slate-600" />
                <span className="hidden sm:inline">Xoay bàn</span>
              </button>

              <button
                type="button"
                onClick={() => setShowHints((prev) => !prev)}
                aria-label={showHints ? 'Tắt gợi ý nước đi hợp lệ' : 'Bật gợi ý nước đi hợp lệ'}
                aria-pressed={showHints}
                title="Bật/tắt chấm gợi ý nước đi"
                className={`p-2.5 sm:px-3 sm:py-1.5 min-h-[44px] min-w-[44px] font-medium rounded-xl border transition-[color,background-color,border-color,transform] flex items-center justify-center gap-1.5 shadow-sm active:scale-95 focus-visible:ring-2 focus-visible:ring-sky-500 ${
                  showHints
                    ? 'bg-sky-50 border-sky-200 text-sky-800'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Lightbulb
                  className={`w-3.5 h-3.5 ${
                    showHints ? 'text-amber-500 fill-amber-500' : 'text-slate-500'
                  }`}
                />
                <span className="hidden sm:inline">Gợi ý {showHints ? 'Bật' : 'Tắt'}</span>
              </button>

              <button
                type="button"
                onClick={toggleSound}
                aria-label={soundEnabled ? 'Tắt âm thanh ván đấu' : 'Bật âm thanh ván đấu'}
                aria-pressed={soundEnabled}
                title="Âm thanh ván đấu"
                className={`p-2.5 sm:px-3 sm:py-1.5 min-h-[44px] min-w-[44px] font-medium rounded-xl border transition-[color,background-color,border-color,transform] flex items-center justify-center gap-1.5 shadow-sm active:scale-95 focus-visible:ring-2 focus-visible:ring-sky-500 ${
                  soundEnabled
                    ? 'bg-sky-50 border-sky-200 text-sky-800'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {soundEnabled ? (
                  <Volume2 className="w-3.5 h-3.5 text-sky-600" />
                ) : (
                  <VolumeX className="w-3.5 h-3.5 text-slate-500" />
                )}
                <span className="hidden sm:inline">Âm thanh</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setStartError('');
                  setShowConfigModal(true);
                }}
                aria-label="Cài đặt cấp độ máy AI và thời gian ván đấu"
                title="Cài đặt cấp độ & thời gian"
                className="p-2.5 sm:px-3 sm:py-1.5 min-h-[44px] min-w-[44px] bg-white hover:bg-slate-50 text-slate-700 font-medium rounded-xl border border-slate-200 shadow-sm flex items-center justify-center gap-1.5 transition-[color,background-color,border-color,transform] active:scale-95 focus-visible:ring-2 focus-visible:ring-sky-500"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-slate-600" />
                <span className="hidden sm:inline">Cài đặt</span>
              </button>
            </div>

            {gameState && gameState.status === 'IN_PROGRESS' && !gameOverResult && (
              <button
                type="button"
                onClick={() => setShowResignModal(true)}
                aria-label="Đầu hàng ván đấu với máy"
                title="Đầu hàng ván đấu"
                className="px-3.5 py-2 sm:py-1.5 min-h-[44px] min-w-[44px] bg-white hover:bg-rose-50 text-rose-700 font-medium rounded-xl border border-rose-200 transition-[color,background-color,border-color,transform] flex items-center justify-center gap-1.5 shadow-sm active:scale-95 focus-visible:ring-2 focus-visible:ring-rose-500"
              >
                <Flag className="w-3.5 h-3.5 text-rose-600" />
                <span>Đầu hàng</span>
              </button>
            )}
          </div>
        </div>

        {/* Right Column: Move History & Match Insights (5 cols) */}
        <div className="lg:col-span-5 min-w-0 flex flex-col gap-3.5 self-stretch">
          {/* Match Insights Card */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/90 flex flex-col gap-3">
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
              <span className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Compass className="w-4 h-4 text-sky-600" />
                Nhận Định Thế Trận
              </span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-mono tabular-nums">
                {aiStats ? (aiStats.score > 0 ? `+${evalPawns}` : evalPawns) : '0.0'}
              </span>
            </div>

            {/* Friendly Assessment Banner */}
            <div className="text-xs text-slate-700 leading-relaxed font-medium">
              {getGameAssessment()}
            </div>

            {/* Visual Balance Bar (GPU scaleX) */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-slate-600 font-medium">
                <span>⚪ Quân Trắng</span>
                <span>Quân Đen ⚫</span>
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden relative shadow-inner">
                <div
                  data-eval-bar="ai"
                  className="motion-eval-bar w-full h-full bg-sky-600 origin-left transition-transform duration-300 rounded-full"
                  style={{
                    transform: `scaleX(${
                      Math.max(
                        8,
                        Math.min(92, 50 + (aiStats ? aiStats.score / 600 : 0) * 50)
                      ) / 100
                    })`,
                  }}
                />
              </div>
            </div>

            {/* Stats row */}
            {aiStats && (
              <div className="grid grid-cols-2 divide-x divide-slate-200/80 pt-3 border-t border-slate-100 text-xs">
                <div className="pr-3">
                  <div className="text-xs text-slate-600 font-medium">Độ sâu tính toán</div>
                  <div className="font-bold text-slate-800 text-xs font-mono tabular-nums mt-0.5">
                    {aiStats.depth} nước đi
                  </div>
                </div>
                <div className="pl-3">
                  <div className="text-xs text-slate-600 font-medium">Thời gian phản hồi</div>
                  <div className="font-bold text-slate-800 text-xs font-mono tabular-nums mt-0.5">
                    {aiStats.durationMs} ms
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Move History (Nhật ký ván cờ) */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/90 flex-1 flex flex-col min-h-[220px] max-h-[340px]">
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
              <span className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-sky-600" />
                Lịch Sử Nước Đi ({moveHistory.length})
              </span>
              <span className="text-xs text-slate-600 font-mono tabular-nums font-medium">
                Nước #{Math.ceil(moveHistory.length / 2) || 1}
              </span>
            </div>

            {/* Note: using ref={moveHistoryContainerRef} and scrollTop to prevent page scrolling! */}
            <div
              ref={moveHistoryContainerRef}
              className="flex-1 overflow-y-auto mt-2 space-y-0.5 text-xs pr-1"
            >
              {moveHistory.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-500 text-xs py-8">
                  <Swords className="w-7 h-7 text-slate-300 mb-2" />
                  <span>Ván cờ chưa có nước đi nào</span>
                  <span className="text-xs text-slate-600 mt-0.5 font-medium">
                    Chọn một quân cờ để bắt đầu đi
                  </span>
                </div>
              ) : (
                <div className="space-y-0.5">
                  {Array.from({ length: Math.ceil(moveHistory.length / 2) }).map((_, i) => {
                    const whiteM = moveHistory[i * 2];
                    const blackM = moveHistory[i * 2 + 1];
                    const isLatest =
                      blackM?.ply === moveHistory[moveHistory.length - 1]?.ply ||
                      (!blackM && whiteM?.ply === moveHistory[moveHistory.length - 1]?.ply);

                    return (
                      <div
                        key={i}
                        className={`flex items-center px-2.5 py-1 rounded-lg transition-colors ${
                          isLatest
                            ? 'bg-sky-50 text-sky-900 font-semibold'
                            : 'hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <span className="w-7 text-slate-600 font-semibold">{i + 1}.</span>
                        <span className="w-20 font-mono tabular-nums font-medium">{whiteM?.san}</span>
                        <span className="flex-1 font-mono tabular-nums font-medium text-slate-600">
                          {blackM?.san || ''}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Setup New Game Modal */}
      {isSetupModalOpen && (
        <div
          onClick={handleExitCreation}
          className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 cursor-pointer animate-in fade-in duration-150"
        >
          <div
            ref={configModalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="setup-dialog-title"
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl w-full max-w-lg max-h-[90dvh] overflow-y-auto p-6 md:p-8 shadow-2xl relative animate-in fade-in zoom-in-95 duration-150 border border-slate-100 cursor-default"
          >
            <button
              type="button"
              onClick={handleExitCreation}
              aria-label={gameState ? 'Đóng bảng thiết lập ván đấu' : 'Thoát khỏi trang tạo ván đấu'}
              title={gameState ? 'Đóng bảng' : 'Thoát về sảnh'}
              className="absolute top-3.5 right-3.5 min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-500 hover:text-slate-700 rounded-full hover:bg-slate-100 transition-colors duration-150 active:scale-[0.96] focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:outline-none"
            >
              <X className="w-5 h-5 text-slate-500 hover:text-slate-800" />
            </button>

            <div className="flex items-center gap-3.5 mb-6 pr-10">
              <div className="w-12 h-12 shrink-0 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center shadow-sm text-white">
                <PieceSvg type="k" color="w" className="w-7 h-7" />
              </div>
              <div className="min-w-0">
                <h2 id="setup-dialog-title" className="text-xl font-bold text-slate-900">Thiết Lập Ván Đấu Mới</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Tùy chỉnh cấp độ máy, thời gian và màu quân cờ
                </p>
              </div>
            </div>

            <div className="space-y-5">
              {/* Trình độ của máy */}
              <fieldset>
                <legend className="block text-xs font-bold text-slate-700 mb-2.5">
                  1. Chọn cấp độ máy
                </legend>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {[
                    {
                      key: 'EASY',
                      label: 'Bot Tập sự',
                      elo: '1000',
                      iconNode: <Bot className="w-5 h-5 text-emerald-600 mb-1" />,
                      desc: 'Nước đi cơ bản, thích hợp giải trí và rèn luyện ban đầu',
                    },
                    {
                      key: 'MEDIUM',
                      label: 'Bot Kỳ thủ',
                      elo: '1500',
                      iconNode: <Bot className="w-5 h-5 text-sky-600 mb-1" />,
                      desc: 'Đánh bài bản, chiến thuật cân bằng và thử thách vừa sức',
                    },
                    {
                      key: 'HARD',
                      label: 'Bot Cao thủ',
                      elo: '2000',
                      iconNode: <Bot className="w-5 h-5 text-indigo-600 mb-1" />,
                      desc: 'Tính toán nước đi sâu, tư duy chiến thuật đỉnh cao',
                    },
                  ].map((d) => (
                    <button
                      key={d.key}
                      type="button"
                      onClick={() => setDifficulty(d.key as AIDifficulty)}
                      aria-pressed={difficulty === d.key}
                      className={`min-h-[44px] p-3 rounded-2xl text-left border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
                        difficulty === d.key
                          ? 'bg-sky-50 border-sky-400 ring-2 ring-sky-100 text-sky-950 shadow-sm'
                          : 'bg-white border-slate-200 hover:border-slate-300 text-slate-600 hover:bg-slate-50/60'
                      }`}
                    >
                      {d.iconNode}
                      <div className="font-bold text-xs text-slate-900 flex flex-wrap items-center justify-between gap-1">
                        <span>{d.label}</span>
                        <span className="text-xs font-mono tabular-nums px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                          {d.elo}
                        </span>
                      </div>
                      <div className="text-xs text-slate-600 mt-1 leading-relaxed">{d.desc}</div>
                    </button>
                  ))}
                </div>
              </fieldset>

              {/* Màu quân cờ */}
              <fieldset>
                <legend className="block text-xs font-bold text-slate-700 mb-2.5">
                  2. Chọn màu quân bạn cầm
                </legend>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {[
                    {
                      key: 'white',
                      label: 'Quân Trắng',
                      iconNode: <PieceSvg type="k" color="w" className="w-6 h-6 shrink-0 sm:mb-1" />,
                      sub: 'Được đi trước',
                    },
                    {
                      key: 'black',
                      label: 'Quân Đen',
                      iconNode: <PieceSvg type="k" color="b" className="w-6 h-6 shrink-0 sm:mb-1" />,
                      sub: 'Đi sau (phản công)',
                    },
                    {
                      key: 'random',
                      label: 'Ngẫu nhiên',
                      iconNode: <span className="text-2xl leading-none shrink-0 sm:mb-1">🎲</span>,
                      sub: 'Tăng tính bất ngờ',
                    },
                  ].map((c) => (
                    <button
                      key={c.key}
                      type="button"
                      onClick={() => setPlayerColor(c.key as any)}
                      aria-pressed={playerColor === c.key}
                      className={`min-h-[44px] p-3 rounded-2xl border transition-colors text-left sm:text-center flex flex-row sm:flex-col items-center sm:justify-center gap-3 sm:gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
                        playerColor === c.key
                          ? 'bg-sky-50 border-sky-400 ring-2 ring-sky-100 text-sky-950 font-semibold shadow-sm'
                          : 'bg-white border-slate-200 hover:border-slate-300 text-slate-600 hover:bg-slate-50/60'
                      }`}
                    >
                      {c.iconNode}
                      <span className="flex flex-col sm:items-center min-w-0">
                        <span className="text-xs font-bold text-slate-900">{c.label}</span>
                        <span className="text-xs leading-snug text-slate-600">{c.sub}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </fieldset>

              {/* Thời gian thi đấu */}
              <fieldset>
                <legend className="block text-xs font-bold text-slate-700 mb-2.5">
                  3. Thời gian ván cờ
                </legend>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {Object.entries(TIME_CONTROLS).map(([key, val]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setSelectedTimeKey(key as keyof typeof TIME_CONTROLS)}
                      aria-pressed={selectedTimeKey === key}
                      className={`min-h-[44px] flex items-center justify-center p-2.5 rounded-xl text-xs font-semibold border transition-colors text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
                        selectedTimeKey === key
                          ? 'bg-sky-50 border-sky-400 text-sky-800 font-bold shadow-sm'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {val.name}
                    </button>
                  ))}
                </div>
              </fieldset>

              {startError && (
                <div
                  role="alert"
                  className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-start gap-2 animate-in fade-in duration-150"
                >
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" aria-hidden="true" />
                  <span>{startError}</span>
                </div>
              )}

              <div className="pt-2 flex flex-col-reverse sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3">
                <button
                  type="button"
                  onClick={handleExitCreation}
                  className="min-h-[44px] py-3.5 px-5 border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold rounded-2xl transition-colors duration-150 text-sm active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:outline-none"
                >
                  {gameState ? 'Hủy bỏ' : 'Hủy & Về sảnh'}
                </button>
                <button
                  type="button"
                  disabled={isStartingGame}
                  onClick={handleStartGame}
                  className="min-h-[44px] flex-1 py-3.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 disabled:pointer-events-none text-white font-bold rounded-2xl shadow-sm transition-colors duration-150 flex items-center justify-center gap-2 text-sm active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:outline-none"
                >
                  <Play className="w-4 h-4 fill-white" />
                  {isStartingGame ? 'Đang khởi tạo...' : 'Bắt Đầu Chơi Ngay'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AI Resign Confirmation Modal */}
      {showResignModal && (
        <div
          onClick={() => {
            if (!isResigning) setShowResignModal(false);
          }}
          className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
        >
          <div
            ref={resignModalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="ai-resign-dialog-title"
            aria-describedby="ai-resign-dialog-desc"
            onClick={(e) => e.stopPropagation()}
            className="bg-white border border-slate-200 rounded-2xl max-w-sm w-full max-h-[90dvh] overflow-y-auto p-6 text-center shadow-modal animate-in fade-in zoom-in-95 duration-150"
          >
            <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-3" />
            <h2 id="ai-resign-dialog-title" className="text-lg font-bold text-slate-900 mb-2">
              Đầu hàng ván đấu với máy?
            </h2>
            <p id="ai-resign-dialog-desc" className="text-xs text-slate-600 mb-6 leading-relaxed">
              Ván cờ hiện tại sẽ kết thúc ngay và tính phần thắng cho máy. Điểm ELO trực tuyến của bạn không bị ảnh hưởng.
            </p>
            <div className="flex flex-col-reverse sm:flex-row gap-2.5 sm:gap-3">
              <button
                type="button"
                disabled={isResigning}
                onClick={() => setShowResignModal(false)}
                className="flex-1 py-2.5 min-h-[44px] bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors"
              >
                Tiếp tục chơi
              </button>
              <button
                type="button"
                disabled={isResigning}
                onClick={handleConfirmResign}
                className="flex-1 py-2.5 min-h-[44px] bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition-colors shadow-sm"
              >
                Đầu hàng ván này
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
        onCancel={() => setPendingPromotion(null)}
      />
    </div>
  );
}
