import { Router } from 'express';
import { z } from 'zod';
import { roomsController } from './rooms.controller';
import { authenticate, optionalAuthenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { createRoomSchema } from '@online-chess/shared';

const joinRoomBodySchema = z.object({
  colorPreference: z.enum(['white', 'black', 'random']).default('random'),
});

const router = Router();

router.get('/', (req, res, next) => roomsController.getRooms(req, res, next));
router.post('/', authenticate, validate(createRoomSchema), (req, res, next) =>
  roomsController.createRoom(req, res, next)
);
router.get('/:id', optionalAuthenticate, (req, res, next) =>
  roomsController.getRoom(req, res, next)
);
router.post('/:id/join', authenticate, validate(joinRoomBodySchema), (req, res, next) =>
  roomsController.joinRoom(req, res, next)
);
router.post('/:id/leave', authenticate, (req, res, next) =>
  roomsController.leaveRoom(req, res, next)
);

export default router;
