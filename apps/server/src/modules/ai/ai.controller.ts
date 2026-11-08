import { Request, Response, NextFunction } from 'express';
import { runAIMoveInWorker } from './aiWorkerPool';
import { gameService } from '../games/games.service';
import { getUserRepository } from '../users/users.repository.impl';
import { AppError } from '../../middleware/errorHandler';
import {
  AIDifficulty,
  AI_SYSTEM_USER_ID,
  GUEST_SYSTEM_USER_ID,
  SOCKET_EVENTS,
} from '@online-chess/shared';
import { getIO } from '../../sockets/gameSocket';
import { gameClockManager } from '../games/gameClock.manager';

export class AIController {
  private get userRepo() {
    return getUserRepository();
  }

  async createAIGame(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const difficulty: AIDifficulty = req.body.difficulty || 'MEDIUM';
      const initialTimeMs = req.body.initialTimeMs || 10 * 60 * 1000;
      const incrementMs = req.body.incrementMs || 0;
      const playerColor = req.body.playerColor || 'white';

      const isHumanWhite =
        playerColor === 'white'
          ? true
          : playerColor === 'black'
          ? false
          : Math.random() < 0.5;

      let humanPlayer = null;
      if (req.user?.userId) {
        humanPlayer = await this.userRepo.findById(req.user.userId);
      }

      const humanName = humanPlayer?.username || 'Người chơi Khách';
      const humanRating = humanPlayer?.eloRating || 1200;
      const humanId = humanPlayer?.id || GUEST_SYSTEM_USER_ID;

      const game = await gameService.createGame({
        whitePlayerId: isHumanWhite ? humanId : AI_SYSTEM_USER_ID,
        whitePlayerName: isHumanWhite ? humanName : `Máy (${difficulty})`,
        whitePlayerRating: isHumanWhite ? humanRating : 1200,
        blackPlayerId: !isHumanWhite ? humanId : AI_SYSTEM_USER_ID,
        blackPlayerName: !isHumanWhite ? humanName : `Máy (${difficulty})`,
        blackPlayerRating: !isHumanWhite ? humanRating : 1200,
        gameMode: 'AI',
        aiDifficulty: difficulty,
        initialTimeMs,
        incrementMs,
      });

      // If AI is white, trigger its opening move immediately!
      if (!isHumanWhite) {
        const aiMove = await runAIMoveInWorker(game.currentFen, difficulty);
        const moveRes = await gameService.makeMove({
          gameId: game.id,
          playerId: AI_SYSTEM_USER_ID,
          from: aiMove.from,
          to: aiMove.to,
          promotion: aiMove.promotion,
          expectedVersion: 0,
        });

        const io = getIO();
        if (io) {
          io.to(`game:${game.id}`).emit(SOCKET_EVENTS.MOVE_RESULT, moveRes.moveResult);
        }
      }

      const updatedState = await gameService.getGameState(game.id);
      res.status(201).json({ success: true, data: updatedState });
    } catch (error) {
      next(error);
    }
  }

  async triggerAIMove(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { gameId } = req.body;
      const game = await gameService.getGameState(gameId);

      if (game.status !== 'IN_PROGRESS') {
        throw new AppError(400, 'Trận đấu đã kết thúc');
      }

      // Check whose turn it is and if AI should move
      const isAITurn =
        (game.currentTurn === 'w' &&
          (game.whitePlayerId === AI_SYSTEM_USER_ID || game.whitePlayerId === 'ai-engine')) ||
        (game.currentTurn === 'b' &&
          (game.blackPlayerId === AI_SYSTEM_USER_ID || game.blackPlayerId === 'ai-engine'));

      if (!isAITurn) {
        throw new AppError(400, 'Chưa đến lượt đi của AI');
      }

      const aiPlayerId = game.currentTurn === 'w' ? game.whitePlayerId! : game.blackPlayerId!;
      const difficulty = (game.aiDifficulty as AIDifficulty) || 'MEDIUM';
      const aiMove = await runAIMoveInWorker(game.currentFen, difficulty);

      const moveResult = await gameService.makeMove({
        gameId: game.id,
        playerId: aiPlayerId,
        from: aiMove.from,
        to: aiMove.to,
        promotion: aiMove.promotion,
        expectedVersion: game.positionVersion,
      });

      const io = getIO();
      if (io) {
        io.to(`game:${game.id}`).emit(SOCKET_EVENTS.MOVE_RESULT, moveResult.moveResult);
      }

      if (moveResult.moveResult.isGameOver) {
        gameClockManager.untrackGame(game.id);
        if (io && moveResult.moveResult.result) {
          io.to(`game:${game.id}`).emit(SOCKET_EVENTS.GAME_OVER, {
            gameId: game.id,
            result: moveResult.moveResult.result,
            terminationReason: moveResult.moveResult.terminationReason,
          });
        }
      } else {
        gameClockManager.syncGameClock(game.id, {
          whiteRemainingMs: moveResult.moveResult.whiteRemainingMs,
          blackRemainingMs: moveResult.moveResult.blackRemainingMs,
          currentTurn: moveResult.moveResult.currentTurn,
          lastMoveTimestamp: Date.now(),
          status: 'IN_PROGRESS',
        });
      }

      res.status(200).json({
        success: true,
        data: moveResult.moveResult,
        stats: aiMove.stats,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const aiController = new AIController();
