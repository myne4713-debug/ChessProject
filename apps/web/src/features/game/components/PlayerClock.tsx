import { memo, useEffect, useRef, useState } from 'react';
import { Clock } from 'lucide-react';

export function formatClock(ms: number): string {
  const totalSecs = Math.max(0, Math.floor(ms / 1000));
  const mins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

export interface PlayerClockProps {
  syncedMs: number;
  syncTimestamp?: number;
  resetKey?: number | string;
  isRunning: boolean;
  isActive: boolean;
  variant?: 'online' | 'ai';
  tickIntervalMs?: number;
  onTimeout?: () => void;
}

/**
 * Self-contained countdown clock component.
 * Isolates interval ticks so parent match pages avoid re-rendering the entire chessboard and chat log every tick.
 */
export const PlayerClock = memo(function PlayerClock({
  syncedMs,
  syncTimestamp,
  resetKey,
  isRunning,
  isActive,
  variant = 'online',
  tickIntervalMs = 250,
  onTimeout,
}: PlayerClockProps) {
  const computeSyncedRemaining = () => {
    if (syncTimestamp === undefined) {
      return Math.max(0, syncedMs);
    }
    return isRunning
      ? Math.max(0, syncedMs - (Date.now() - syncTimestamp))
      : Math.max(0, syncedMs);
  };

  const [displayMs, setDisplayMs] = useState<number>(computeSyncedRemaining);
  const onTimeoutRef = useRef(onTimeout);
  onTimeoutRef.current = onTimeout;
  const lastTimeoutEmitRef = useRef(0);

  // Server-synced clock updates whenever authoritative timestamp or running flag updates
  useEffect(() => {
    if (syncTimestamp === undefined) return;
    setDisplayMs(
      isRunning
        ? Math.max(0, syncedMs - (Date.now() - syncTimestamp))
        : Math.max(0, syncedMs)
    );
  }, [syncedMs, syncTimestamp, isRunning]);

  // Local AI clock resets only when initial time or resetKey changes (pausing across turns retains remaining time)
  useEffect(() => {
    if (syncTimestamp !== undefined) return;
    setDisplayMs(Math.max(0, syncedMs));
  }, [syncedMs, resetKey, syncTimestamp]);

  // Isolated countdown interval
  useEffect(() => {
    if (!isRunning) return;

    if (syncTimestamp !== undefined) {
      const interval = setInterval(() => {
        const remaining = Math.max(0, syncedMs - (Date.now() - syncTimestamp));
        setDisplayMs((prev) => {
          const prevSec = Math.floor(prev / 1000);
          const nextSec = Math.floor(remaining / 1000);
          const prevUrgent = prev < 30000;
          const nextUrgent = remaining < 30000;
          const prevZero = prev <= 0;
          const nextZero = remaining <= 0;
          if (prevSec !== nextSec || prevUrgent !== nextUrgent || prevZero !== nextZero) {
            return remaining;
          }
          return prev;
        });

        if (remaining <= 0 && onTimeoutRef.current) {
          const now = Date.now();
          if (now - lastTimeoutEmitRef.current >= 1500) {
            lastTimeoutEmitRef.current = now;
            onTimeoutRef.current();
          }
        }
      }, tickIntervalMs);

      return () => clearInterval(interval);
    }

    const interval = setInterval(() => {
      setDisplayMs((prev) => Math.max(0, prev - tickIntervalMs));
    }, tickIntervalMs);

    return () => clearInterval(interval);
  }, [isRunning, syncedMs, syncTimestamp, tickIntervalMs]);

  if (variant === 'ai') {
    return (
      <div
        className={`px-3 py-1.5 rounded-xl font-mono tabular-nums text-sm font-bold flex items-center gap-1.5 transition-colors ${
          isActive
            ? 'bg-sky-50 text-sky-700 border border-sky-200'
            : 'bg-slate-100 text-slate-600 border border-slate-200/60'
        }`}
      >
        <Clock className="w-3.5 h-3.5 text-slate-500" />
        <span>{formatClock(displayMs)}</span>
      </div>
    );
  }

  return (
    <div
      className={`px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-xl font-mono tabular-nums text-lg font-bold flex items-center gap-2 tracking-tight transition-colors ${
        isActive
          ? displayMs < 30000
            ? 'bg-rose-600 text-white animate-pulse'
            : 'bg-sky-700 text-white shadow-sm'
          : 'bg-slate-100 text-slate-700 border border-slate-200'
      }`}
    >
      <Clock className="w-4 h-4" />
      <span>{formatClock(displayMs)}</span>
    </div>
  );
});
