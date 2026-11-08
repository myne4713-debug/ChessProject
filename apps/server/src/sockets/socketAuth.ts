import { Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { AuthJwtPayload } from '../middleware/auth';
import { logger } from '../config/logger';
import { getUserRepository } from '../modules/users/users.repository.impl';

export interface AuthenticatedSocket extends Socket {
  data: {
    user?: AuthJwtPayload;
  };
}

export async function socketAuthMiddleware(
  socket: Socket,
  next: (err?: Error) => void
): Promise<void> {
  const token =
    socket.handshake.auth?.token ||
    (socket.handshake.headers.authorization?.startsWith('Bearer ')
      ? socket.handshake.headers.authorization.split(' ')[1]
      : null);

  if (!token) {
    // We allow anonymous/guest sockets to connect for spectator mode or public updates,
    // but protected actions verify socket.data.user
    return next();
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as AuthJwtPayload;
    const userRepo = getUserRepository();
    const user = await userRepo.findById(decoded.userId);
    if (user && user.accountStatus !== 'SUSPENDED' && user.isEmailVerified) {
      socket.data.user = decoded;
    } else {
      socket.data.user = undefined;
    }
    next();
  } catch (error) {
    logger.warn('Socket connection attempted with invalid or expired token, continuing as guest');
    socket.data.user = undefined;
    next();
  }
}
