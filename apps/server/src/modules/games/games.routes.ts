import { Router } from 'express';
import { z } from 'zod';
import { gamesController } from './games.controller';
import { authenticate, optionalAuthenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';

const makeMoveRestSchema = z.object({
  from: z.string().regex(/^[a-h][1-8]$/, 'Tọa độ ô đi không hợp lệ'),
  to: z.string().regex(/^[a-h][1-8]$/, 'Tọa độ ô đến không hợp lệ'),
  promotion: z.enum(['q', 'r', 'b', 'n']).optional(),
  expectedVersion: z.number().int().nonnegative().optional(),
});

const router = Router();

router.get('/history/me', authenticate, (req, res, next) =>
  gamesController.getMyHistory(req, res, next)
);

router.get('/:id', optionalAuthenticate, (req, res, next) =>
  gamesController.getGame(req, res, next)
);

router.get('/:id/moves', optionalAuthenticate, (req, res, next) =>
  gamesController.getMoves(req, res, next)
);

router.get('/:id/replay', optionalAuthenticate, (req, res, next) =>
  gamesController.getReplay(req, res, next)
);

router.post('/:id/move', optionalAuthenticate, validate(makeMoveRestSchema), (req, res, next) =>
  gamesController.makeMove(req, res, next)
);

router.post('/:id/resign', optionalAuthenticate, (req, res, next) =>
  gamesController.resign(req, res, next)
);

router.post('/:id/claim-timeout', authenticate, (req, res, next) =>
  gamesController.claimTimeout(req, res, next)
);

router.post('/:id/draw-offer', authenticate, (req, res, next) =>
  gamesController.drawOffer(req, res, next)
);

router.post('/:id/draw-accept', authenticate, (req, res, next) =>
  gamesController.drawAccept(req, res, next)
);

export default router;
