import { randomUUID } from 'crypto';
import {
  IGameRepository,
  GameRecord,
  ExecuteMoveTransactionParams,
  ExecuteMoveTransactionResult,
} from './games.repository';
import { MoveData, STARTING_FEN } from '@online-chess/shared';
import { prisma, isDatabaseConnected } from '../../database/prisma';
import { getUserRepository } from '../users/users.repository.impl';
import { AppError } from '../../middleware/errorHandler';
import { ratingsService, RatingChangeResult } from '../ratings/ratings.service';

export class MemoryGameRepository implements IGameRepository {
  private games: Map<string, GameRecord> = new Map();
  private moves: Map<string, MoveData[]> = new Map();

  async create(data: {
    whitePlayerId: string;
    whitePlayerName: string;
    whitePlayerRating: number;
    blackPlayerId?: string | null;
    blackPlayerName?: string | null;
    blackPlayerRating?: number | null;
    gameMode: GameRecord['gameMode'];
    aiDifficulty?: string | null;
    initialTimeMs: number;
    incrementMs: number;
  }): Promise<GameRecord> {
    const now = new Date();
    const game: GameRecord = {
      id: randomUUID(),
      whitePlayerId: data.whitePlayerId,
      whitePlayerName: data.whitePlayerName,
      whitePlayerRating: data.whitePlayerRating,
      blackPlayerId: data.blackPlayerId ?? null,
      blackPlayerName: data.blackPlayerName ?? (data.gameMode === 'AI' ? 'StockAI' : null),
      blackPlayerRating: data.blackPlayerRating ?? (data.gameMode === 'AI' ? 1500 : null),
      gameMode: data.gameMode,
      aiDifficulty: data.aiDifficulty ?? null,
      status: 'IN_PROGRESS',
      result: null,
      terminationReason: null,
      initialTimeMs: data.initialTimeMs,
      incrementMs: data.incrementMs,
      whiteRemainingMs: data.initialTimeMs,
      blackRemainingMs: data.initialTimeMs,
      currentTurn: 'w',
      currentFen: STARTING_FEN,
      positionVersion: 0,
      drawOfferedBy: null,
      lastMoveTimestamp: Date.now(),
      positionHistory: [STARTING_FEN],
      startedAt: now,
      endedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    this.games.set(game.id, game);
    this.moves.set(game.id, []);
    return game;
  }

  async findById(id: string): Promise<GameRecord | null> {
    return this.games.get(id) || null;
  }

  async update(id: string, data: Partial<GameRecord>): Promise<GameRecord> {
    const existing = this.games.get(id);
    if (!existing) {
      throw new Error(`Game ${id} not found`);
    }
    const updated: GameRecord = {
      ...existing,
      ...data,
      updatedAt: new Date(),
    };
    this.games.set(id, updated);
    return updated;
  }

  async updateWithVersion(
    id: string,
    expectedVersion: number,
    data: Partial<GameRecord>
  ): Promise<GameRecord> {
    const existing = this.games.get(id);
    if (!existing) {
      throw new AppError(404, `Game ${id} not found`);
    }
    if (existing.positionVersion !== expectedVersion) {
      throw new AppError(
        409,
        `Trạng thái bàn cờ đã thay đổi (Phiên bản yêu cầu: ${expectedVersion}, Hiện tại: ${existing.positionVersion})`
      );
    }
    const updated: GameRecord = {
      ...existing,
      ...data,
      positionVersion: expectedVersion + 1,
      updatedAt: new Date(),
    };
    this.games.set(id, updated);
    return updated;
  }

  async addMove(moveData: Omit<MoveData, 'id' | 'createdAt'>): Promise<MoveData> {
    const list = this.moves.get(moveData.gameId) || [];
    const move: MoveData = {
      ...moveData,
      id: randomUUID(),
      createdAt: new Date().toISOString(),
    };
    list.push(move);
    this.moves.set(moveData.gameId, list);
    return move;
  }

  async getMovesByGameId(gameId: string): Promise<MoveData[]> {
    return this.moves.get(gameId) || [];
  }

  async getUserGames(
    userId: string,
    skip = 0,
    take = 20
  ): Promise<{ games: GameRecord[]; total: number }> {
    const all = Array.from(this.games.values())
      .filter((g) => g.whitePlayerId === userId || g.blackPlayerId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return {
      games: all.slice(skip, skip + take),
      total: all.length,
    };
  }

  async getUserStats(userId: string): Promise<{
    gamesPlayed: number;
    wins: number;
    draws: number;
    losses: number;
    winRate: number;
  }> {
    const userGames = Array.from(this.games.values()).filter(
      (g) =>
        (g.whitePlayerId === userId || g.blackPlayerId === userId) &&
        g.status === 'COMPLETED'
    );

    let wins = 0;
    let draws = 0;
    let losses = 0;

    for (const g of userGames) {
      if (g.result === 'DRAW') {
        draws++;
      } else if (g.result === 'WHITE_WON') {
        if (g.whitePlayerId === userId) wins++;
        else losses++;
      } else if (g.result === 'BLACK_WON') {
        if (g.blackPlayerId === userId) wins++;
        else losses++;
      }
    }

    const gamesPlayed = userGames.length;
    const winRate = gamesPlayed > 0 ? Math.round((wins / gamesPlayed) * 100) : 0;

    return { gamesPlayed, wins, draws, losses, winRate };
  }

  async executeMoveTransaction(
    params: ExecuteMoveTransactionParams
  ): Promise<ExecuteMoveTransactionResult> {
    const existing = this.games.get(params.gameId);
    if (!existing) {
      throw new AppError(404, `Game ${params.gameId} not found`);
    }
    if (existing.positionVersion !== params.expectedVersion) {
      throw new AppError(
        409,
        `Trạng thái bàn cờ đã thay đổi (Phiên bản yêu cầu: ${params.expectedVersion}, Hiện tại: ${existing.positionVersion})`
      );
    }

    const move: MoveData = {
      ...params.moveData,
      id: randomUUID(),
      createdAt: new Date().toISOString(),
    };
    const list = this.moves.get(params.gameId) || [];
    list.push(move);
    this.moves.set(params.gameId, list);

    let ratingChanges: RatingChangeResult | undefined;
    if (params.ratingCalculation) {
      const userRepo = getUserRepository();
      const whiteUser = await userRepo.findById(params.ratingCalculation.whitePlayerId);
      const blackUser = await userRepo.findById(params.ratingCalculation.blackPlayerId);
      if (whiteUser && blackUser) {
        const { whiteChange, blackChange } = ratingsService.calculateEloChange(
          whiteUser.eloRating,
          blackUser.eloRating,
          params.ratingCalculation.result
        );
        const whiteAfter = Math.max(100, whiteUser.eloRating + whiteChange);
        const blackAfter = Math.max(100, blackUser.eloRating + blackChange);
        await userRepo.update(whiteUser.id, { eloRating: whiteAfter });
        await userRepo.update(blackUser.id, { eloRating: blackAfter });
        ratingChanges = {
          whiteRatingBefore: whiteUser.eloRating,
          whiteRatingAfter: whiteAfter,
          whiteRatingChange: whiteChange,
          blackRatingBefore: blackUser.eloRating,
          blackRatingAfter: blackAfter,
          blackRatingChange: blackChange,
        };
      }
    }

    const updated: GameRecord = {
      ...existing,
      ...params.gameUpdate,
      positionVersion: params.expectedVersion + 1,
      updatedAt: new Date(),
    };
    this.games.set(params.gameId, updated);

    return { move, game: updated, ratingChanges };
  }
}

export class PrismaGameRepository implements IGameRepository {
  private lastMoveTimestamps: Map<string, number> = new Map();

  async create(data: {
    whitePlayerId?: string | null;
    whitePlayerName: string;
    whitePlayerRating: number;
    blackPlayerId?: string | null;
    blackPlayerName?: string | null;
    blackPlayerRating?: number | null;
    gameMode: GameRecord['gameMode'];
    aiDifficulty?: string | null;
    initialTimeMs: number;
    incrementMs: number;
  }): Promise<GameRecord> {
    const now = new Date();
    const game = await prisma.game.create({
      data: {
        whitePlayerId: data.whitePlayerId || undefined,
        blackPlayerId: data.blackPlayerId || undefined,
        gameMode: data.gameMode,
        aiDifficulty: data.aiDifficulty || undefined,
        status: 'IN_PROGRESS',
        initialTimeMs: data.initialTimeMs,
        incrementMs: data.incrementMs,
        whiteRemainingMs: data.initialTimeMs,
        blackRemainingMs: data.initialTimeMs,
        currentTurn: 'w',
        currentFen: STARTING_FEN,
        positionVersion: 0,
        lastMoveTimestamp: BigInt(now.getTime()),
        positionHistory: [STARTING_FEN],
        startedAt: now,
      },
      include: {
        whitePlayer: true,
        blackPlayer: true,
      },
    });

    return {
      id: game.id,
      whitePlayerId: game.whitePlayerId,
      whitePlayerName: game.whitePlayer ? game.whitePlayer.username : data.whitePlayerName,
      whitePlayerRating: game.whitePlayer ? game.whitePlayer.eloRating : data.whitePlayerRating,
      blackPlayerId: game.blackPlayerId,
      blackPlayerName: game.blackPlayer ? game.blackPlayer.username : 'StockAI',
      blackPlayerRating: game.blackPlayer ? game.blackPlayer.eloRating : 1500,
      gameMode: game.gameMode as any,
      aiDifficulty: game.aiDifficulty,
      status: game.status as any,
      result: game.result as any,
      terminationReason: game.terminationReason as any,
      initialTimeMs: game.initialTimeMs,
      incrementMs: game.incrementMs,
      whiteRemainingMs: game.whiteRemainingMs,
      blackRemainingMs: game.blackRemainingMs,
      currentTurn: game.currentTurn as any,
      currentFen: game.currentFen,
      positionVersion: game.positionVersion,
      startedAt: game.startedAt,
      endedAt: game.endedAt,
      createdAt: game.createdAt,
      updatedAt: game.updatedAt,
      lastMoveTimestamp: Number(game.lastMoveTimestamp),
      positionHistory: game.positionHistory,
    };
  }

  async findById(id: string): Promise<GameRecord | null> {
    const game = await prisma.game.findUnique({
      where: { id },
      include: {
        whitePlayer: true,
        blackPlayer: true,
      },
    });
    if (!game) return null;

    return {
      id: game.id,
      whitePlayerId: game.whitePlayerId,
      whitePlayerName: game.whitePlayer ? game.whitePlayer.username : 'Bạn',
      whitePlayerRating: game.whitePlayer ? game.whitePlayer.eloRating : 1200,
      blackPlayerId: game.blackPlayerId,
      blackPlayerName: game.blackPlayer ? game.blackPlayer.username : 'StockAI',
      blackPlayerRating: game.blackPlayer ? game.blackPlayer.eloRating : 1500,
      gameMode: game.gameMode as any,
      aiDifficulty: game.aiDifficulty,
      status: game.status as any,
      result: game.result as any,
      terminationReason: game.terminationReason as any,
      initialTimeMs: game.initialTimeMs,
      incrementMs: game.incrementMs,
      whiteRemainingMs: game.whiteRemainingMs,
      blackRemainingMs: game.blackRemainingMs,
      currentTurn: game.currentTurn as any,
      currentFen: game.currentFen,
      positionVersion: game.positionVersion,
      startedAt: game.startedAt,
      endedAt: game.endedAt,
      createdAt: game.createdAt,
      updatedAt: game.updatedAt,
      lastMoveTimestamp: game.lastMoveTimestamp ? Number(game.lastMoveTimestamp) : game.updatedAt.getTime(),
      positionHistory: game.positionHistory || [],
    };
  }

  async update(id: string, data: Partial<GameRecord>): Promise<GameRecord> {
    const updated = await prisma.game.update({
      where: { id },
      data: {
        status: data.status as any,
        result: data.result as any,
        terminationReason: data.terminationReason as any,
        currentFen: data.currentFen,
        currentTurn: data.currentTurn,
        positionVersion: data.positionVersion,
        whiteRemainingMs: data.whiteRemainingMs,
        blackRemainingMs: data.blackRemainingMs,
        lastMoveTimestamp: data.lastMoveTimestamp ? BigInt(data.lastMoveTimestamp) : undefined,
        positionHistory: data.positionHistory,
        endedAt: data.endedAt,
      },
      include: {
        whitePlayer: true,
        blackPlayer: true,
      },
    });

    return {
      id: updated.id,
      whitePlayerId: updated.whitePlayerId,
      whitePlayerName: updated.whitePlayer ? updated.whitePlayer.username : 'Bạn',
      whitePlayerRating: updated.whitePlayer ? updated.whitePlayer.eloRating : 1200,
      blackPlayerId: updated.blackPlayerId,
      blackPlayerName: updated.blackPlayer ? updated.blackPlayer.username : 'StockAI',
      blackPlayerRating: updated.blackPlayer ? updated.blackPlayer.eloRating : 1500,
      gameMode: updated.gameMode as any,
      aiDifficulty: updated.aiDifficulty,
      status: updated.status as any,
      result: updated.result as any,
      terminationReason: updated.terminationReason as any,
      initialTimeMs: updated.initialTimeMs,
      incrementMs: updated.incrementMs,
      whiteRemainingMs: updated.whiteRemainingMs,
      blackRemainingMs: updated.blackRemainingMs,
      currentTurn: updated.currentTurn as any,
      currentFen: updated.currentFen,
      positionVersion: updated.positionVersion,
      startedAt: updated.startedAt,
      endedAt: updated.endedAt,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
      lastMoveTimestamp: updated.lastMoveTimestamp ? Number(updated.lastMoveTimestamp) : updated.updatedAt.getTime(),
      positionHistory: updated.positionHistory || [],
    };
  }

  async updateWithVersion(
    id: string,
    expectedVersion: number,
    data: Partial<GameRecord>
  ): Promise<GameRecord> {
    const updatedResult = await prisma.game.updateMany({
      where: {
        id,
        positionVersion: expectedVersion,
      },
      data: {
        status: data.status as any,
        result: data.result as any,
        terminationReason: data.terminationReason as any,
        currentFen: data.currentFen,
        currentTurn: data.currentTurn,
        positionVersion: expectedVersion + 1,
        whiteRemainingMs: data.whiteRemainingMs,
        blackRemainingMs: data.blackRemainingMs,
        lastMoveTimestamp: data.lastMoveTimestamp ? BigInt(data.lastMoveTimestamp) : undefined,
        positionHistory: data.positionHistory,
        endedAt: data.endedAt,
      },
    });

    if (updatedResult.count === 0) {
      throw new AppError(
        409,
        `Trạng thái bàn cờ đã thay đổi (Xung đột đồng thời: Phiên bản yêu cầu: ${expectedVersion})`
      );
    }

    const updated = await this.findById(id);
    if (!updated) {
      throw new AppError(404, 'Không tìm thấy trận đấu');
    }
    return updated;
  }

  async addMove(moveData: Omit<MoveData, 'id' | 'createdAt'>): Promise<MoveData> {
    const move = await prisma.move.create({
      data: {
        gameId: moveData.gameId,
        moveNumber: moveData.moveNumber,
        ply: moveData.ply,
        playerId: moveData.playerId || undefined,
        fromSquare: moveData.fromSquare,
        toSquare: moveData.toSquare,
        promotion: moveData.promotion || undefined,
        san: moveData.san,
        fenAfter: moveData.fenAfter,
        clockRemainingMs: moveData.clockRemainingMs || undefined,
      },
    });

    return {
      id: move.id,
      gameId: move.gameId,
      moveNumber: move.moveNumber,
      ply: move.ply,
      playerId: move.playerId,
      fromSquare: move.fromSquare,
      toSquare: move.toSquare,
      promotion: move.promotion,
      san: move.san,
      fenAfter: move.fenAfter,
      clockRemainingMs: move.clockRemainingMs,
      createdAt: move.createdAt.toISOString(),
    };
  }

  async getMovesByGameId(gameId: string): Promise<MoveData[]> {
    const moves = await prisma.move.findMany({
      where: { gameId },
      orderBy: { ply: 'asc' },
    });
    return moves.map((m) => ({
      id: m.id,
      gameId: m.gameId,
      moveNumber: m.moveNumber,
      ply: m.ply,
      playerId: m.playerId,
      fromSquare: m.fromSquare,
      toSquare: m.toSquare,
      promotion: m.promotion,
      san: m.san,
      fenAfter: m.fenAfter,
      clockRemainingMs: m.clockRemainingMs,
      createdAt: m.createdAt.toISOString(),
    }));
  }

  async getUserGames(
    userId: string,
    skip = 0,
    take = 20
  ): Promise<{ games: GameRecord[]; total: number }> {
    const where = {
      OR: [{ whitePlayerId: userId }, { blackPlayerId: userId }],
    };

    const [games, total] = await Promise.all([
      prisma.game.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: { whitePlayer: true, blackPlayer: true },
      }),
      prisma.game.count({ where }),
    ]);

    return {
      games: games.map((g) => ({
        id: g.id,
        whitePlayerId: g.whitePlayerId,
        whitePlayerName: g.whitePlayer ? g.whitePlayer.username : 'Bạn',
        whitePlayerRating: g.whitePlayer ? g.whitePlayer.eloRating : 1200,
        blackPlayerId: g.blackPlayerId,
        blackPlayerName: g.blackPlayer ? g.blackPlayer.username : 'StockAI',
        blackPlayerRating: g.blackPlayer ? g.blackPlayer.eloRating : 1500,
        gameMode: g.gameMode as any,
        aiDifficulty: g.aiDifficulty,
        status: g.status as any,
        result: g.result as any,
        terminationReason: g.terminationReason as any,
        initialTimeMs: g.initialTimeMs,
        incrementMs: g.incrementMs,
        whiteRemainingMs: g.whiteRemainingMs,
        blackRemainingMs: g.blackRemainingMs,
        currentTurn: g.currentTurn as any,
        currentFen: g.currentFen,
        positionVersion: g.positionVersion,
        startedAt: g.startedAt,
        endedAt: g.endedAt,
        createdAt: g.createdAt,
        updatedAt: g.updatedAt,
      })),
      total,
    };
  }

  async getUserStats(userId: string): Promise<{
    gamesPlayed: number;
    wins: number;
    draws: number;
    losses: number;
    winRate: number;
  }> {
    const completedGames = await prisma.game.findMany({
      where: {
        status: 'COMPLETED',
        OR: [{ whitePlayerId: userId }, { blackPlayerId: userId }],
      },
      select: {
        whitePlayerId: true,
        blackPlayerId: true,
        result: true,
      },
    });

    let wins = 0;
    let draws = 0;
    let losses = 0;

    for (const g of completedGames) {
      if (g.result === 'DRAW') {
        draws++;
      } else if (g.result === 'WHITE_WON') {
        if (g.whitePlayerId === userId) wins++;
        else losses++;
      } else if (g.result === 'BLACK_WON') {
        if (g.blackPlayerId === userId) wins++;
        else losses++;
      }
    }

    const gamesPlayed = completedGames.length;
    const winRate = gamesPlayed > 0 ? Math.round((wins / gamesPlayed) * 100) : 0;

    return { gamesPlayed, wins, draws, losses, winRate };
  }

  async executeMoveTransaction(
    params: ExecuteMoveTransactionParams
  ): Promise<ExecuteMoveTransactionResult> {
    return await prisma.$transaction(async (tx) => {
      // 1. CAS Game update
      const updatedResult = await tx.game.updateMany({
        where: {
          id: params.gameId,
          positionVersion: params.expectedVersion,
        },
        data: {
          status: params.gameUpdate.status as any,
          result: params.gameUpdate.result as any,
          terminationReason: params.gameUpdate.terminationReason as any,
          currentFen: params.gameUpdate.currentFen,
          currentTurn: params.gameUpdate.currentTurn,
          positionVersion: params.expectedVersion + 1,
          whiteRemainingMs: params.gameUpdate.whiteRemainingMs,
          blackRemainingMs: params.gameUpdate.blackRemainingMs,
          lastMoveTimestamp: params.gameUpdate.lastMoveTimestamp
            ? BigInt(params.gameUpdate.lastMoveTimestamp)
            : undefined,
          positionHistory: params.gameUpdate.positionHistory,
          endedAt: params.gameUpdate.endedAt,
        },
      });

      if (updatedResult.count === 0) {
        throw new AppError(
          409,
          `Trạng thái bàn cờ đã thay đổi (Xung đột đồng thời: Phiên bản yêu cầu: ${params.expectedVersion})`
        );
      }

      // 2. Add move atomically in same transaction
      const moveRecord = await tx.move.create({
        data: {
          gameId: params.moveData.gameId,
          moveNumber: params.moveData.moveNumber,
          ply: params.moveData.ply,
          playerId: params.moveData.playerId || undefined,
          fromSquare: params.moveData.fromSquare,
          toSquare: params.moveData.toSquare,
          promotion: params.moveData.promotion || undefined,
          san: params.moveData.san,
          fenAfter: params.moveData.fenAfter,
          clockRemainingMs: params.moveData.clockRemainingMs || undefined,
        },
      });

      const move: MoveData = {
        id: moveRecord.id,
        gameId: moveRecord.gameId,
        moveNumber: moveRecord.moveNumber,
        ply: moveRecord.ply,
        playerId: moveRecord.playerId,
        fromSquare: moveRecord.fromSquare,
        toSquare: moveRecord.toSquare,
        promotion: moveRecord.promotion,
        san: moveRecord.san,
        fenAfter: moveRecord.fenAfter,
        clockRemainingMs: moveRecord.clockRemainingMs,
        createdAt: moveRecord.createdAt.toISOString(),
      };

      // 3. Atomically calculate and apply Rating changes inside same transaction if game is over
      let ratingChanges: RatingChangeResult | undefined;
      if (params.ratingCalculation) {
        const whiteUser = await tx.user.findUnique({
          where: { id: params.ratingCalculation.whitePlayerId },
        });
        const blackUser = await tx.user.findUnique({
          where: { id: params.ratingCalculation.blackPlayerId },
        });

        if (whiteUser && blackUser) {
          const whiteBefore = whiteUser.eloRating;
          const blackBefore = blackUser.eloRating;

          const { whiteChange, blackChange } = ratingsService.calculateEloChange(
            whiteBefore,
            blackBefore,
            params.ratingCalculation.result
          );

          const whiteAfter = Math.max(100, whiteBefore + whiteChange);
          const blackAfter = Math.max(100, blackBefore + blackChange);

          await tx.user.update({
            where: { id: whiteUser.id },
            data: { eloRating: whiteAfter },
          });

          await tx.user.update({
            where: { id: blackUser.id },
            data: { eloRating: blackAfter },
          });

          await tx.ratingHistory.createMany({
            data: [
              {
                userId: whiteUser.id,
                gameId: params.gameId,
                ratingBefore: whiteBefore,
                ratingAfter: whiteAfter,
                ratingChange: whiteChange,
              },
              {
                userId: blackUser.id,
                gameId: params.gameId,
                ratingBefore: blackBefore,
                ratingAfter: blackAfter,
                ratingChange: blackChange,
              },
            ],
          });

          ratingChanges = {
            whiteRatingBefore: whiteBefore,
            whiteRatingAfter: whiteAfter,
            whiteRatingChange: whiteChange,
            blackRatingBefore: blackBefore,
            blackRatingAfter: blackAfter,
            blackRatingChange: blackChange,
          };
        }
      }

      // 4. Fetch the updated game record within transaction
      const updatedGameDb = await tx.game.findUniqueOrThrow({
        where: { id: params.gameId },
        include: { whitePlayer: true, blackPlayer: true },
      });

      const updatedGame: GameRecord = {
        id: updatedGameDb.id,
        whitePlayerId: updatedGameDb.whitePlayerId,
        whitePlayerName: updatedGameDb.whitePlayer ? updatedGameDb.whitePlayer.username : 'Bạn',
        whitePlayerRating: updatedGameDb.whitePlayer ? updatedGameDb.whitePlayer.eloRating : 1200,
        blackPlayerId: updatedGameDb.blackPlayerId,
        blackPlayerName: updatedGameDb.blackPlayer ? updatedGameDb.blackPlayer.username : 'StockAI',
        blackPlayerRating: updatedGameDb.blackPlayer ? updatedGameDb.blackPlayer.eloRating : 1500,
        gameMode: updatedGameDb.gameMode as any,
        aiDifficulty: updatedGameDb.aiDifficulty,
        status: updatedGameDb.status as any,
        result: updatedGameDb.result as any,
        terminationReason: updatedGameDb.terminationReason as any,
        initialTimeMs: updatedGameDb.initialTimeMs,
        incrementMs: updatedGameDb.incrementMs,
        whiteRemainingMs: updatedGameDb.whiteRemainingMs,
        blackRemainingMs: updatedGameDb.blackRemainingMs,
        currentTurn: updatedGameDb.currentTurn as any,
        currentFen: updatedGameDb.currentFen,
        positionVersion: updatedGameDb.positionVersion,
        startedAt: updatedGameDb.startedAt,
        endedAt: updatedGameDb.endedAt,
        createdAt: updatedGameDb.createdAt,
        updatedAt: updatedGameDb.updatedAt,
        lastMoveTimestamp: updatedGameDb.lastMoveTimestamp
          ? Number(updatedGameDb.lastMoveTimestamp)
          : updatedGameDb.updatedAt.getTime(),
        positionHistory: updatedGameDb.positionHistory || [],
      };

      return { move, game: updatedGame, ratingChanges };
    });
  }
}

const memoryGameRepo = new MemoryGameRepository();
const prismaGameRepo = new PrismaGameRepository();

export function getGameRepository(): IGameRepository {
  if (isDatabaseConnected) {
    return prismaGameRepo;
  }
  return memoryGameRepo;
}
