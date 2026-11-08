import { Router } from 'express';
import { z } from 'zod';
import { aiController } from './ai.controller';
import { optionalAuthenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { createAiGameSchema } from '@online-chess/shared';

const triggerAiMoveSchema = z.object({
  gameId: z.string().uuid('ID ván đấu không hợp lệ'),
});

const router = Router();

router.post('/game', optionalAuthenticate, validate(createAiGameSchema), (req, res, next) =>
  aiController.createAIGame(req, res, next)
);

router.post('/move', optionalAuthenticate, validate(triggerAiMoveSchema), (req, res, next) =>
  aiController.triggerAIMove(req, res, next)
);

export default router;
