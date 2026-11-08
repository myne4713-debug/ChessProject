import { getIO } from '../../sockets/gameSocket';
import { SOCKET_EVENTS } from '@online-chess/shared';
import { getGameRepository } from './games.repository.impl';
import { gameService } from './games.service';
import { logger } from '../../config/logger';

export interface ClockSyncState {
  whiteRemainingMs: number;
  blackRemainingMs: number;
  currentTurn: 'w' | 'b';
  lastMoveTimestamp: number;
  status?: string;
}

export class GameClockManager {
  private activeGameIds: Set<string> = new Set();
  private clockCache: Map<string, ClockSyncState> = new Map();
  private intervalTimer: NodeJS.Timeout | null = null;
  private pendingFetches: Set<string> = new Set();

  start(): void {
    if (this.intervalTimer) return;
    this.intervalTimer = setInterval(() => this.tick(), 1000);
  }

  stop(): void {
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
    }
    this.activeGameIds.clear();
    this.clockCache.clear();
    this.pendingFetches.clear();
  }

  syncGameClock(gameId: string, state: ClockSyncState): void {
    if (state.status && state.status !== 'IN_PROGRESS') {
      this.untrackGame(gameId);
      return;
    }
    this.clockCache.set(gameId, state);
    this.activeGameIds.add(gameId);
    if (!this.intervalTimer) {
      this.start();
    }
  }

  async trackGame(gameId: string, initialState?: ClockSyncState): Promise<void> {
    this.activeGameIds.add(gameId);
    if (initialState) {
      this.syncGameClock(gameId, initialState);
    } else if (!this.clockCache.has(gameId) && !this.pendingFetches.has(gameId)) {
      this.pendingFetches.add(gameId);
      try {
        const gameRepo = getGameRepository();
        const game = await gameRepo.findById(gameId);
        if (game && game.status === 'IN_PROGRESS') {
          this.clockCache.set(gameId, {
            whiteRemainingMs: game.whiteRemainingMs,
            blackRemainingMs: game.blackRemainingMs,
            currentTurn: game.currentTurn as 'w' | 'b',
            lastMoveTimestamp: game.lastMoveTimestamp ? new Date(game.lastMoveTimestamp).getTime() : Date.now(),
            status: game.status,
          });
        } else {
          this.untrackGame(gameId);
        }
      } catch (err) {
        logger.error(err, `Failed to load clock state for game ${gameId}`);
      } finally {
        this.pendingFetches.delete(gameId);
      }
    }

    if (!this.intervalTimer && this.activeGameIds.size > 0) {
      this.start();
    }
  }

  untrackGame(gameId: string): void {
    this.activeGameIds.delete(gameId);
    this.clockCache.delete(gameId);
    this.pendingFetches.delete(gameId);
    if (this.activeGameIds.size === 0 && this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
    }
  }

  private async tick(): Promise<void> {
    if (this.activeGameIds.size === 0) return;

    const io = getIO();
    const now = Date.now();

    for (const gameId of Array.from(this.activeGameIds)) {
      const clock = this.clockCache.get(gameId);
      if (!clock) {
        // If not yet loaded into cache, trigger async fetch
        if (!this.pendingFetches.has(gameId)) {
          this.trackGame(gameId);
        }
        continue;
      }

      try {
        const elapsed = clock.lastMoveTimestamp ? Math.max(0, now - clock.lastMoveTimestamp) : 0;
        const isWhite = clock.currentTurn === 'w';

        const whiteRemaining = isWhite
          ? Math.max(0, clock.whiteRemainingMs - elapsed)
          : clock.whiteRemainingMs;
        const blackRemaining = !isWhite
          ? Math.max(0, clock.blackRemainingMs - elapsed)
          : clock.blackRemainingMs;

        // Broadcast clock sync
        if (io) {
          io.to(`game:${gameId}`).emit(SOCKET_EVENTS.CLOCK_UPDATE, {
            whiteRemainingMs: whiteRemaining,
            blackRemainingMs: blackRemaining,
          });
        }

        // Check if active player timed out
        const activeRemaining = isWhite ? whiteRemaining : blackRemaining;
        if (activeRemaining <= 0) {
          this.untrackGame(gameId);
          logger.info(`Server Clock Manager: Game ${gameId} timed out for color ${clock.currentTurn}`);

          const timeoutResult = await gameService.claimTimeout(gameId);
          if (io) {
            io.to(`game:${gameId}`).emit(SOCKET_EVENTS.MOVE_RESULT, timeoutResult.moveResult);
            io.to(`game:${gameId}`).emit(SOCKET_EVENTS.GAME_OVER, {
              gameId,
              result: timeoutResult.moveResult.result,
              terminationReason: timeoutResult.moveResult.terminationReason,
              whiteEloChange: timeoutResult.ratingChanges?.whiteRatingChange,
              blackEloChange: timeoutResult.ratingChanges?.blackRatingChange,
              newWhiteElo: timeoutResult.ratingChanges?.whiteRatingAfter,
              newBlackElo: timeoutResult.ratingChanges?.blackRatingAfter,
            });
          }
        }
      } catch (err) {
        logger.error(err, `Error ticking clock for game ${gameId}`);
      }
    }
  }
}

export const gameClockManager = new GameClockManager();
