import { roomService } from '../rooms/rooms.service';
import { RoomData } from '@online-chess/shared';

export interface MatchmakingQueueEntry {
  userId: string;
  username: string;
  eloRating: number;
  initialTimeMs: number;
  incrementMs: number;
  joinedAt: number;
  socketId: string;
}

export class MatchmakingService {
  private queue: MatchmakingQueueEntry[] = [];

  addToQueue(entry: MatchmakingQueueEntry): { matched: boolean; room?: RoomData; opponent?: MatchmakingQueueEntry } {
    // Check if player is already in queue
    this.removeFromQueue(entry.userId);

    const now = Date.now();
    const entryWaitSec = (now - entry.joinedAt) / 1000;
    const entryWindow = 100 + Math.floor(entryWaitSec / 5) * 50;

    // Filter compatible opponents with identical time control and different user
    const compatibleOpponents = this.queue
      .map((q, index) => {
        const qWaitSec = (now - q.joinedAt) / 1000;
        const qWindow = 100 + Math.floor(qWaitSec / 5) * 50;
        const maxAllowedDiff = Math.max(entryWindow, qWindow);
        const eloDiff = Math.abs(q.eloRating - entry.eloRating);
        return {
          q,
          index,
          eloDiff,
          isMatch:
            q.initialTimeMs === entry.initialTimeMs &&
            q.incrementMs === entry.incrementMs &&
            q.userId !== entry.userId &&
            eloDiff <= maxAllowedDiff,
        };
      })
      .filter((item) => item.isMatch)
      .sort((a, b) => a.eloDiff - b.eloDiff);

    if (compatibleOpponents.length > 0) {
      const bestMatch = compatibleOpponents[0];
      const opponent = this.queue.splice(bestMatch.index, 1)[0];
      return {
        matched: true,
        opponent,
      };
    }

    this.queue.push(entry);
    return { matched: false };
  }

  removeFromQueue(userId: string): boolean {
    const idx = this.queue.findIndex((q) => q.userId === userId);
    if (idx !== -1) {
      this.queue.splice(idx, 1);
      return true;
    }
    return false;
  }

  getQueueStatus(userId: string) {
    const entry = this.queue.find((q) => q.userId === userId);
    return {
      inQueue: !!entry,
      queuedTimeMs: entry ? Date.now() - entry.joinedAt : 0,
      totalInQueue: this.queue.length,
    };
  }
}

export const matchmakingService = new MatchmakingService();
