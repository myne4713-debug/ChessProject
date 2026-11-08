import { Request, Response, NextFunction } from 'express';
import { gameService } from './games.service';
import { AppError } from '../../middleware/errorHandler';
import { getIO } from '../../sockets/gameSocket';
import { SOCKET_EVENTS, GUEST_SYSTEM_USER_ID } from '@online-chess/shared';
import { gameClockManager } from './gameClock.manager';

export class GamesController {
  async getGame(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const game = await gameService.getGameState(req.params.id);
      res.status(200).json({ success: true, data: game });
    } catch (error) {
      next(error);
    }
  }

  async getMoves(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const state = await gameService.getGameState(req.params.id);
      res.status(200).json({ success: true, data: state.moves });
    } catch (error) {
      next(error);
    }
  }

  async getReplay(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const replay = await gameService.getReplay(req.params.id);
      res.status(200).json({ success: true, data: replay });
    } catch (error) {
      next(error);
    }
  }

  async getMyHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AppError(401, 'Chưa đăng nhập');
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const result = await gameService.getUserGameHistory(req.user.userId, page, limit);
      res.status(200).json({
        success: true,
        data: result.games,
        total: result.total,
        page,
        limit,
      });
    } catch (error) {
      next(error);
    }
  }

  async makeMove(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const gameId = req.params.id;
      const playerId = req.user?.userId || GUEST_SYSTEM_USER_ID;
      const { from, to, promotion, expectedVersion } = req.body;

      const result = await gameService.makeMove({
        gameId,
        playerId,
        from,
        to,
        promotion,
        expectedVersion,
      });

      // Broadcast move to Socket.IO clients watching this game
      const io = getIO();
      if (io) {
        io.to(`game:${gameId}`).emit(SOCKET_EVENTS.MOVE_RESULT, result.moveResult);
      }

      if (result.moveResult.isGameOver) {
        gameClockManager.untrackGame(gameId);
        if (io && result.moveResult.result) {
          io.to(`game:${gameId}`).emit(SOCKET_EVENTS.GAME_OVER, {
            gameId,
            result: result.moveResult.result,
            terminationReason: result.moveResult.terminationReason,
            whiteEloChange: result.ratingChanges?.whiteRatingChange,
            blackEloChange: result.ratingChanges?.blackRatingChange,
            newWhiteElo: result.ratingChanges?.whiteRatingAfter,
            newBlackElo: result.ratingChanges?.blackRatingAfter,
          });
        }
      } else {
        gameClockManager.syncGameClock(gameId, {
          whiteRemainingMs: result.moveResult.whiteRemainingMs,
          blackRemainingMs: result.moveResult.blackRemainingMs,
          currentTurn: result.moveResult.currentTurn,
          lastMoveTimestamp: Date.now(),
          status: 'IN_PROGRESS',
        });
      }

      res.status(200).json({
        success: true,
        data: result.moveResult,
        ratingChanges: result.ratingChanges,
      });
    } catch (error) {
      next(error);
    }
  }

  async resign(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const gameId = req.params.id;
      const playerId = req.user?.userId || GUEST_SYSTEM_USER_ID;
      const result = await gameService.resign(gameId, playerId);

      const io = getIO();
      if (io) {
        io.to(`game:${gameId}`).emit(SOCKET_EVENTS.GAME_OVER, {
          gameId,
          result: result.game.result,
          terminationReason: result.game.terminationReason,
          whiteEloChange: result.ratingChanges?.whiteRatingChange,
          blackEloChange: result.ratingChanges?.blackRatingChange,
          newWhiteElo: result.ratingChanges?.whiteRatingAfter,
          newBlackElo: result.ratingChanges?.blackRatingAfter,
        });
      }
      gameClockManager.untrackGame(gameId);

      res.status(200).json({
        success: true,
        message: 'Đã đầu hàng trận đấu',
        data: result.game,
        ratingChanges: result.ratingChanges,
      });
    } catch (error) {
      next(error);
    }
  }

  async claimTimeout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const gameId = req.params.id;
      const playerId = req.user?.userId;
      const result = await gameService.claimTimeout(gameId, playerId);

      const io = getIO();
      if (io) {
        io.to(`game:${gameId}`).emit(SOCKET_EVENTS.MOVE_RESULT, result.moveResult);
        io.to(`game:${gameId}`).emit(SOCKET_EVENTS.GAME_OVER, {
          gameId,
          result: result.moveResult.result,
          terminationReason: result.moveResult.terminationReason,
          whiteEloChange: result.ratingChanges?.whiteRatingChange,
          blackEloChange: result.ratingChanges?.blackRatingChange,
          newWhiteElo: result.ratingChanges?.whiteRatingAfter,
          newBlackElo: result.ratingChanges?.blackRatingAfter,
        });
      }
      gameClockManager.untrackGame(gameId);

      res.status(200).json({
        success: true,
        message: 'Xử lý hết thời gian thành công',
        data: result.moveResult,
        ratingChanges: result.ratingChanges,
      });
    } catch (error) {
      next(error);
    }
  }

  async drawOffer(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AppError(401, 'Chưa đăng nhập');
      const gameId = req.params.id;
      const result = await gameService.offerDraw(gameId, req.user.userId);

      const io = getIO();
      if (io) {
        io.to(`game:${gameId}`).emit(SOCKET_EVENTS.DRAW_OFFER, {
          gameId,
          offeredBy: req.user.userId,
        });
      }

      res.status(200).json({
        success: true,
        message: 'Đã gửi lời mời hòa tới đối thủ',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async drawAccept(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AppError(401, 'Chưa đăng nhập');
      const gameId = req.params.id;
      const result = await gameService.acceptDraw(gameId, req.user.userId);

      const io = getIO();
      if (io) {
        io.to(`game:${gameId}`).emit(SOCKET_EVENTS.DRAW_ACCEPT, { gameId });
        io.to(`game:${gameId}`).emit(SOCKET_EVENTS.GAME_OVER, {
          gameId,
          result: result.game.result,
          terminationReason: result.game.terminationReason,
          whiteEloChange: result.ratingChanges?.whiteRatingChange,
          blackEloChange: result.ratingChanges?.blackRatingChange,
          newWhiteElo: result.ratingChanges?.whiteRatingAfter,
          newBlackElo: result.ratingChanges?.blackRatingAfter,
        });
      }
      gameClockManager.untrackGame(gameId);

      res.status(200).json({
        success: true,
        message: 'Trận đấu kết thúc với kết quả hòa',
        data: result.game,
        ratingChanges: result.ratingChanges,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const gamesController = new GamesController();
