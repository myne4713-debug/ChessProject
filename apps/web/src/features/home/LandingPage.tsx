import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Swords,
  Bot,
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Cpu,
  Radio,
  BarChart3,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { PieceSvg } from '../../components/chess/PieceSvg';
import { DEMO_BOARDS, DEMO_MOVES } from './demoBoards';

export default function LandingPage() {
  const [currentStep, setCurrentStep] = useState(6);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isStageVisible, setIsStageVisible] = useState(true);
  const [isTabVisible, setIsTabVisible] = useState(() =>
    typeof document === 'undefined' ? true : !document.hidden
  );
  const stageRef = useRef<HTMLDivElement | null>(null);
  const playTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const board = DEMO_BOARDS[currentStep] ?? DEMO_BOARDS[0];
  const lastMove = currentStep > 0 ? DEMO_MOVES[currentStep - 1] : null;
  const currentEval = currentStep > 0 ? DEMO_MOVES[currentStep - 1].evalScore : 0.2;
  const evalFraction = Math.min(0.95, Math.max(0.05, (50 + currentEval * 20) / 100));

  // Pause demo loop when stage scrolls offscreen or browser tab is hidden
  useEffect(() => {
    const handleVisibility = () => setIsTabVisible(!document.hidden);
    document.addEventListener('visibilitychange', handleVisibility);

    let observer: IntersectionObserver | null = null;
    if (typeof IntersectionObserver !== 'undefined' && stageRef.current) {
      observer = new IntersectionObserver(
        (entries) => {
          if (entries[0]) {
            setIsStageVisible(entries[0].isIntersecting);
          }
        },
        { threshold: 0.1 }
      );
      observer.observe(stageRef.current);
    }

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      observer?.disconnect();
    };
  }, []);

  // Auto-play stepper
  useEffect(() => {
    if (isPlaying && isStageVisible && isTabVisible) {
      playTimerRef.current = setInterval(() => {
        setCurrentStep((prev) => {
          if (prev >= DEMO_MOVES.length) {
            return 1;
          }
          return prev + 1;
        });
      }, 1600);
    } else if (playTimerRef.current) {
      clearInterval(playTimerRef.current);
      playTimerRef.current = null;
    }
    return () => {
      if (playTimerRef.current) {
        clearInterval(playTimerRef.current);
        playTimerRef.current = null;
      }
    };
  }, [isPlaying, isStageVisible, isTabVisible]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 md:py-16 flex flex-col items-center">
      {/* Editorial Hero Announcement */}
      <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-100 border border-slate-200/90 text-xs font-semibold text-slate-800 mb-6">
        <span className="w-2 h-2 rounded-full bg-emerald-500" aria-hidden="true" />
        <span>Hệ thống thi đấu cờ vua trực tuyến chuẩn Elo quốc tế</span>
      </div>

      {/* Main Title - Pure intentional typography without artificial gradient fills */}
      <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-slate-900 tracking-tight text-center max-w-4xl leading-[1.12] mb-6">
        Đấu Trường Cờ Vua Đỉnh Cao. <br />
        Chuẩn Xác Từng Giây.
      </h1>

      {/* Subtitle */}
      <p className="max-w-2xl text-slate-600 text-base sm:text-lg text-center mb-8 leading-relaxed font-normal">
        Trải nghiệm thi đấu cờ vua thời gian thực với đồng hồ chuẩn xác FIDE, ghép cặp đối thủ
        tự động theo Elo và phân tích thế trận chuyên sâu cùng thuật toán Minimax AI.
      </p>

      {/* Hero Primary Actions (One primary filled action per view) */}
      <div className="flex flex-wrap gap-3.5 justify-center mb-10">
        <Link
          to="/lobby"
          className="px-6 py-3.5 rounded-xl font-bold text-white bg-slate-900 hover:bg-slate-800 shadow-sm transition-colors duration-150 flex items-center gap-2 text-sm active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-slate-900"
        >
          <Swords className="w-4 h-4 text-sky-400" />
          <span>Vào phòng thi đấu</span>
        </Link>
        <Link
          to="/ai"
          className="px-6 py-3.5 rounded-xl font-bold text-slate-800 bg-white hover:bg-slate-50 border border-slate-300 shadow-subtle transition-colors duration-150 flex items-center gap-2 text-sm hover:border-slate-400 active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-sky-500"
        >
          <Bot className="w-4 h-4 text-slate-700" />
          <span>Luyện tập với máy AI</span>
        </Link>
      </div>

      {/* Time Control Launchpad (Tactical Fast Access) */}
      <div className="w-full max-w-3xl grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-14">
        {[
          { icon: '⚡', time: '1 + 0', label: 'Bullet', desc: 'Siêu tốc 1 phút', param: 'BULLET_1' },
          { icon: '⏱️', time: '3 + 0', label: 'Blitz', desc: 'Chớp 3 phút', param: 'BLITZ_3' },
          { icon: '🔥', time: '5 + 0', label: 'Blitz', desc: 'Chớp 5 phút', param: 'BLITZ_5' },
          { icon: '🛡️', time: '10 + 0', label: 'Rapid', desc: 'Cờ nhanh 10 phút', param: 'RAPID_10' },
        ].map((tc) => (
          <Link
            key={tc.time}
            to={`/lobby?time=${tc.param}`}
            className="group p-3 rounded-xl bg-white border border-slate-200/90 hover:border-slate-400 hover:shadow-subtle transition-colors duration-150 flex flex-col justify-between"
          >
            <div className="flex items-center justify-between">
              <span className="text-base">{tc.icon}</span>
              <span className="text-xs font-bold font-mono tabular-nums px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                {tc.time}
              </span>
            </div>
            <div className="mt-2.5">
              <div className="text-xs font-bold text-slate-900 group-hover:text-sky-700 transition-colors">
                {tc.label}
              </div>
              <div className="text-xs text-slate-500">{tc.desc}</div>
            </div>
          </Link>
        ))}
      </div>

      {/* Hero Interactive Chess Tournament Stage */}
      <div
        ref={stageRef}
        data-testid="landing-chess-stage"
        className="w-full max-w-4xl bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-7 shadow-card mb-16 relative"
      >
        <div className="flex flex-col lg:flex-row items-center gap-6">
          {/* Left: The Chess Arena */}
          <div className="w-full max-w-[380px] sm:max-w-[420px] flex flex-col gap-2">
            {/* Black Player Bar */}
            <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-900 text-white text-xs">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-xs text-white">
                  B
                </div>
                <div>
                  <div className="font-bold text-white flex items-center gap-1.5">
                    <span>Minimax Engine v4</span>
                    <span className="text-xs px-1.5 py-0.5 rounded bg-indigo-500/30 text-indigo-200 border border-indigo-400/30">
                      BOT
                    </span>
                  </div>
                  <div className="text-xs text-slate-300 font-mono tabular-nums">2450 ELO</div>
                </div>
              </div>
              <div className="flex items-center gap-1.5 font-mono tabular-nums text-sm font-bold bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800 text-amber-400">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                <span>04:48</span>
              </div>
            </div>

            {/* 8x8 Board with Evaluation Bar */}
            <div className="flex gap-2 items-stretch">
              {/* Evaluation Bar (GPU scaleY) */}
              <div
                data-eval-bar="landing"
                className="w-4 rounded-md overflow-hidden bg-slate-900 relative border border-slate-300 select-none"
                title={`Đánh giá thế trận: +${currentEval}`}
              >
                <div
                  className="motion-eval-bar absolute inset-0 bg-white origin-bottom transition-transform duration-300"
                  style={{
                    transform: `scaleY(${evalFraction})`,
                  }}
                />
              </div>

              {/* 8x8 Chess Squares */}
              <div className="flex-1 aspect-square overflow-hidden grid grid-cols-8 grid-rows-8">
                {board.map((row, rIdx) =>
                  row.map((piece, cIdx) => {
                    const isDark = (rIdx + cIdx) % 2 === 1;
                    const file = String.fromCharCode(97 + cIdx);
                    const rank = 8 - rIdx;
                    const squareName = `${file}${rank}`;
                    const isLastMoveFrom = lastMove?.from === squareName;
                    const isLastMoveTo = lastMove?.to === squareName;

                    let bgClass = isDark ? 'bg-chess-boardDark' : 'bg-chess-boardLight';
                    if (isLastMoveFrom || isLastMoveTo) {
                      bgClass = isDark ? 'bg-chess-boardHighlightDark' : 'bg-chess-boardHighlight';
                    }

                    return (
                      <div
                        key={squareName}
                        className={`relative flex items-center justify-center ${bgClass} select-none transition-colors duration-150`}
                      >
                        {/* Ranks coordinate */}
                        {cIdx === 0 && (
                          <span
                            className={`absolute top-0.5 left-1 text-xs font-bold font-mono pointer-events-none leading-none ${
                              isDark ? 'text-white' : 'text-slate-800'
                            }`}
                          >
                            {rank}
                          </span>
                        )}
                        {/* Files coordinate */}
                        {rIdx === 7 && (
                          <span
                            className={`absolute bottom-0.5 right-1 text-xs font-bold font-mono pointer-events-none leading-none ${
                              isDark ? 'text-white' : 'text-slate-800'
                            }`}
                          >
                            {file}
                          </span>
                        )}

                        {piece && (
                          <PieceSvg
                            type={piece.type}
                            color={piece.color}
                            className="w-4/5 h-4/5 drop-shadow pointer-events-none"
                          />
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* White Player Bar */}
            <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-900 text-white text-xs">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-sky-700 flex items-center justify-center font-bold text-xs text-white">
                  W
                </div>
                <div>
                  <div className="font-bold text-white">Bạn (Đại kiện tướng)</div>
                  <div className="text-xs text-slate-300 font-mono tabular-nums">1850 ELO</div>
                </div>
              </div>
              <div className="flex items-center gap-1.5 font-mono tabular-nums text-sm font-bold bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800 text-emerald-400">
                <Clock className="w-3.5 h-3.5 text-emerald-400" />
                <span>05:00</span>
              </div>
            </div>

            {/* Interactive Playback Controls */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-slate-600 text-xs">
              <button
                onClick={() => {
                  setIsPlaying(false);
                  setCurrentStep(0);
                }}
                disabled={currentStep === 0}
                aria-label="Về thế cờ ban đầu"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none transition-colors focus-visible:ring-2 focus-visible:ring-sky-500"
              >
                <RotateCcw className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => {
                    setIsPlaying(false);
                    setCurrentStep((p) => Math.max(0, p - 1));
                  }}
                  disabled={currentStep === 0}
                  aria-label="Nước cờ trước"
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none transition-colors focus-visible:ring-2 focus-visible:ring-sky-500"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <button
                  onClick={() => setIsPlaying(!isPlaying)}
                  aria-label={isPlaying ? 'Tạm dừng tự động phát' : 'Tự động phát nước đi'}
                  className="min-h-[44px] px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-medium text-xs flex items-center justify-center gap-1.5 transition-colors focus-visible:ring-2 focus-visible:ring-sky-500"
                >
                  {isPlaying ? (
                    <>
                      <Pause className="w-3.5 h-3.5" />
                      <span>Dừng</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5" />
                      <span>Phát tự động</span>
                    </>
                  )}
                </button>

                <button
                  data-testid="landing-next-move"
                  onClick={() => {
                    setIsPlaying(false);
                    setCurrentStep((p) => Math.min(DEMO_MOVES.length, p + 1));
                  }}
                  disabled={currentStep >= DEMO_MOVES.length}
                  aria-label="Nước cờ kế tiếp"
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none transition-colors focus-visible:ring-2 focus-visible:ring-sky-500"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <span className="font-mono tabular-nums text-xs text-slate-500 font-medium">
                {currentStep} / {DEMO_MOVES.length} nước
              </span>
            </div>
          </div>

          {/* Right: Opening Notation & Match Chronicle */}
          <div className="flex-1 w-full space-y-4">
            <div className="border-b border-slate-100 pb-3">
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-sky-50 text-sky-800 border border-sky-100">
                Khai cuộc Sicilian Najdorf
              </span>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mt-2">
                Trực quan hóa thế trận và phân tích nước cờ
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 mt-1">
                Nhấp vào từng nước cờ bên dưới để theo dõi chuyển biến thế trận trên bàn cờ tương tác.
              </p>
            </div>

            {/* Notation Move Grid */}
            <div className="border-y border-slate-200/80 py-3 text-xs font-mono tabular-nums">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {Array.from({ length: Math.ceil(DEMO_MOVES.length / 2) }).map((_, pairIdx) => {
                  const whiteMove = DEMO_MOVES[pairIdx * 2];
                  const blackMove = DEMO_MOVES[pairIdx * 2 + 1];
                  const isWhiteActive = currentStep === pairIdx * 2 + 1;
                  const isBlackActive = currentStep === pairIdx * 2 + 2;

                  return (
                    <div key={pairIdx} className="flex items-center gap-1.5 py-1 px-2 rounded-lg hover:bg-white transition-colors">
                      <span className="text-slate-600 w-5 tabular-nums font-semibold">{pairIdx + 1}.</span>
                      {whiteMove && (
                        <button
                          onClick={() => {
                            setIsPlaying(false);
                            setCurrentStep(pairIdx * 2 + 1);
                          }}
                          className={`px-2.5 py-1.5 min-h-[44px] sm:min-h-[34px] rounded-lg transition-colors text-left flex-1 focus-visible:ring-2 focus-visible:ring-sky-500 ${
                            isWhiteActive
                              ? 'bg-slate-900 text-white font-bold'
                              : 'text-slate-800 hover:bg-slate-200'
                          }`}
                        >
                          {whiteMove.san}
                        </button>
                      )}
                      {blackMove && (
                        <button
                          onClick={() => {
                            setIsPlaying(false);
                            setCurrentStep(pairIdx * 2 + 2);
                          }}
                          className={`px-2.5 py-1.5 min-h-[44px] sm:min-h-[34px] rounded-lg transition-colors text-left flex-1 focus-visible:ring-2 focus-visible:ring-sky-500 ${
                            isBlackActive
                              ? 'bg-slate-900 text-white font-bold'
                              : 'text-slate-800 hover:bg-slate-200'
                          }`}
                        >
                          {blackMove.san}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Tactical feature checklist */}
            <div className="space-y-2 text-xs text-slate-700 font-medium">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span>Đồng bộ nước đi qua giao thức WebSocket hai chiều không độ trễ</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span>Hỗ trợ luật phong cấp tốt, bắt tốt qua đường (En Passant) và nhập thành</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span>Lưu trữ toàn bộ lịch sử biên bản PGN và xem lại từng nước đi</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* The Three Tournament Pillars (Engine, Network, Elo) */}
      <div className="w-full bg-white rounded-2xl border border-slate-200/90 shadow-card grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-200/80 text-left mb-16">
        {/* Pillar 1: Minimax AI Engine */}
        <div className="p-6 flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-slate-900 text-base mb-2 flex items-center gap-2">
              <Cpu className="w-4 h-4 text-sky-700 shrink-0" aria-hidden="true" />
              <span>Động Cơ Minimax & Alpha-Beta</span>
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-normal">
              Thuật toán duyệt cây tìm kiếm thông minh kết hợp cắt tỉa Alpha-Beta Pruning,
              đánh giá vị trí và gợi ý nước đi chiến thuật giúp nâng cao trình độ.
            </p>
          </div>
          <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-mono tabular-nums">
            <span>Độ sâu: 3 cấp độ</span>
            <span className="text-emerald-700 font-semibold font-sans">Thời gian thực</span>
          </div>
        </div>

        {/* Pillar 2: WebSocket Realtime Sync */}
        <div className="p-6 flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-slate-900 text-base mb-2 flex items-center gap-2">
              <Radio className="w-4 h-4 text-sky-700 shrink-0" aria-hidden="true" />
              <span>Hạ Tầng WebSocket Độ Trễ Thấp</span>
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-normal">
              Đồng bộ trạng thái ván cờ tức thì, bù trễ mili-giây cho đồng hồ thi đấu
              và cơ chế tự động tái kết nối khi mạng gián đoạn.
            </p>
          </div>
          <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-mono tabular-nums">
            <span>Ping &lt; 20ms</span>
            <span className="text-emerald-700 font-semibold font-sans">Bảo toàn đồng hồ</span>
          </div>
        </div>

        {/* Pillar 3: Elo Rating & PGN History */}
        <div className="p-6 flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-slate-900 text-base mb-2 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-sky-700 shrink-0" aria-hidden="true" />
              <span>Hệ Thống Xếp Hạng Elo FIDE</span>
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-normal">
              Tính toán hệ số Elo chuẩn sau mỗi trận đấu, bảng xếp hạng minh bạch
              và công cụ xem lại lịch sử ván cờ trực&nbsp;quan.
            </p>
          </div>
          <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-mono tabular-nums">
            <span>K-Factor: 32</span>
            <span className="text-emerald-700 font-semibold font-sans">Lưu trữ PGN</span>
          </div>
        </div>
      </div>

      {/* Community Call to Action */}
      <div className="w-full bg-slate-900 text-white rounded-2xl p-8 sm:p-10 text-center relative overflow-hidden">
        <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-3">
          Sẵn sàng thử thách bản thân trên bàn cờ?
        </h2>
        <p className="text-slate-300 text-sm max-w-xl mx-auto mb-6">
          Tạo phòng đấu riêng cùng bạn bè, ghép cặp ngẫu nhiên theo điểm Elo hoặc rèn luyện chiến thuật cùng máy AI.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/lobby"
            className="px-6 py-3 rounded-xl bg-white text-slate-900 font-bold text-sm hover:bg-slate-100 transition-colors active:scale-[0.98]"
          >
            Vào Sảnh Thi Đấu
          </Link>
          <Link
            to="/ai"
            className="px-6 py-3 rounded-xl bg-slate-800 text-white border border-slate-700 font-semibold text-sm hover:bg-slate-700 transition-colors active:scale-[0.98]"
          >
            Đấu với Máy AI
          </Link>
        </div>
      </div>
    </div>
  );
}
