import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { roomService } from '../src/modules/rooms/rooms.service';
import { gameClockManager } from '../src/modules/games/gameClock.manager';
import { aiWorkerPool, runAIMoveInWorker } from '../src/modules/ai/aiWorkerPool';
import { gameService } from '../src/modules/games/games.service';
import { getGameRepository } from '../src/modules/games/games.repository.impl';
import { STARTING_FEN, GUEST_SYSTEM_USER_ID } from '@online-chess/shared';
import { isOriginAllowed } from '../src/config/cors';

describe('Phase 2 Architecture & Performance Remediation Tests', () => {
  const app = createApp();
  describe('H-04: Room Joining Concurrency Mutex', () => {
    it('should prevent race condition when 2 players join simultaneously', async () => {
      const room = await roomService.createRoom({
        hostId: 'host-user-1',
        hostUsername: 'host_player',
        hostRating: 1400,
        visibility: 'PUBLIC',
        initialTimeMs: 300000,
        incrementMs: 0,
        colorPreference: 'white',
      });

      // Simulate 2 players clicking "Join Room" at the exact same instant
      const join1 = roomService.joinRoom({
        roomIdOrCode: room.id,
        userId: 'guest-player-1',
        username: 'guest_1',
        userRating: 1350,
      });

      const join2 = roomService.joinRoom({
        roomIdOrCode: room.id,
        userId: 'guest-player-2',
        username: 'guest_2',
        userRating: 1380,
      });

      const results = await Promise.allSettled([join1, join2]);

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');

      // Exactly 1 join must succeed, and 1 must be rejected due to room capacity
      expect(fulfilled.length).toBe(1);
      expect(rejected.length).toBe(1);

      if (rejected[0].status === 'rejected') {
        expect((rejected[0] as PromiseRejectedResult).reason.message).toContain('đủ 2 người');
      }

      // Room must have exactly 2 players (host + 1 joined guest)
      const updatedRoom = await roomService.getRoom(room.id);
      expect(updatedRoom?.players.length).toBe(2);
      expect(updatedRoom?.status).toBe('IN_PROGRESS');
      expect(updatedRoom?.gameId).toBeDefined();
    });
  });

  describe('H-02: Game Clock Manager In-Memory Ticking', () => {
    afterEach(() => {
      gameClockManager.stop();
    });

    it('should sync clock state in RAM and not query database on every tick', async () => {
      const gameRepo = getGameRepository();
      const game = await gameService.createGame({
        whitePlayerId: 'white-user',
        whitePlayerName: 'White',
        whitePlayerRating: 1200,
        blackPlayerId: 'black-user',
        blackPlayerName: 'Black',
        blackPlayerRating: 1200,
        gameMode: 'PVP',
        initialTimeMs: 180000,
        incrementMs: 0,
      });

      const findByIdSpy = vi.spyOn(gameRepo, 'findById');

      // Sync state into clock manager memory
      gameClockManager.syncGameClock(game.id, {
        whiteRemainingMs: 180000,
        blackRemainingMs: 180000,
        currentTurn: 'w',
        lastMoveTimestamp: Date.now(),
        status: 'IN_PROGRESS',
      });

      // Trigger tick manually
      await (gameClockManager as any).tick();

      // No DB query should be executed because state is already cached in memory!
      expect(findByIdSpy).not.toHaveBeenCalled();

      // Clean up
      gameClockManager.untrackGame(game.id);
      findByIdSpy.mockRestore();
    });
  });

  describe('H-01: AI Worker Pool', () => {
    it('should compute an AI move via worker pool or isolated computation', async () => {
      const move = await runAIMoveInWorker(STARTING_FEN, 'EASY');
      expect(move).toBeDefined();
      expect(move.from).toBeDefined();
      expect(move.to).toBeDefined();
      expect(move.san).toBeDefined();
    });
  });

  describe('M-02 & M-06: REST Zod Validation & Guest AI Moves', () => {
    it('should reject invalid move coordinates with 400 Bad Request', async () => {
      const res = await request(app)
        .post('/api/v1/games/00000000-0000-0000-0000-000000000000/move')
        .send({
          from: 'z9', // Invalid square
          to: 'e4',
        });

      expect(res.status).toBe(400);
    });

    it('should reject invalid AI difficulty with 400 Bad Request', async () => {
      const res = await request(app)
        .post('/api/v1/ai/game')
        .send({
          difficulty: 'IMPOSSIBLE', // Invalid enum
        });

      expect(res.status).toBe(400);
    });

    it('should allow guest player to create and move in an AI game without 401', async () => {
      const gameRes = await request(app)
        .post('/api/v1/ai/game')
        .send({
          difficulty: 'EASY',
          playerColor: 'white',
        });

      expect(gameRes.status).toBe(201);
      const gameId = gameRes.body.data.id;
      expect(gameId).toBeDefined();

      // Guest makes e2 -> e4 without authorization header
      const moveRes = await request(app)
        .post(`/api/v1/games/${gameId}/move`)
        .send({
          from: 'e2',
          to: 'e4',
          expectedVersion: 0,
        });

      expect(moveRes.status).toBe(200);
      expect(moveRes.body.data.move.san).toBe('e4');
    });
  });

  describe('M-05: Strict Production CORS Tunnels Lockdown', () => {
    it('should block arbitrary dev tunnels in production mode', async () => {
      const { env } = await import('../src/config/env');
      const prev = env.NODE_ENV;
      try {
        (env as any).NODE_ENV = 'production';
        const tunnelOrigin = 'https://random-attacker.trycloudflare.com';
        expect(isOriginAllowed(tunnelOrigin)).toBe(false);

        const ngrokOrigin = 'https://fake-tunnel.ngrok-free.app';
        expect(isOriginAllowed(ngrokOrigin)).toBe(false);

        // Explicitly configured origins are allowed
        expect(isOriginAllowed('http://localhost:5173')).toBe(true);
      } finally {
        (env as any).NODE_ENV = prev;
      }
    });
  });

  describe('L-01: User Stats Calculation', () => {
    it('should aggregate wins, losses, draws and win rate from actual games', async () => {
      const userRepo = (await import('../src/modules/users/users.repository.impl')).getUserRepository();
      const testUser = await userRepo.create({
        username: 'stats_player_' + Date.now(),
        email: `stats_${Date.now()}@chess.local`,
        passwordHash: 'hash',
        role: 'PLAYER',
        isEmailVerified: true,
      });

      const gameRepo = getGameRepository();

      // Create 1 won game as white
      const g1 = await gameService.createGame({
        whitePlayerId: testUser.id,
        whitePlayerName: testUser.username,
        whitePlayerRating: 1200,
        blackPlayerId: 'opp-1',
        blackPlayerName: 'Opponent 1',
        blackPlayerRating: 1200,
        gameMode: 'PVP',
        initialTimeMs: 60000,
        incrementMs: 0,
      });
      await gameRepo.update(g1.id, { status: 'COMPLETED', result: 'WHITE_WON' });

      // Create 1 lost game as black
      const g2 = await gameService.createGame({
        whitePlayerId: 'opp-2',
        whitePlayerName: 'Opponent 2',
        whitePlayerRating: 1200,
        blackPlayerId: testUser.id,
        blackPlayerName: testUser.username,
        blackPlayerRating: 1200,
        gameMode: 'PVP',
        initialTimeMs: 60000,
        incrementMs: 0,
      });
      await gameRepo.update(g2.id, { status: 'COMPLETED', result: 'WHITE_WON' });

      // Create 1 draw game
      const g3 = await gameService.createGame({
        whitePlayerId: testUser.id,
        whitePlayerName: testUser.username,
        whitePlayerRating: 1200,
        blackPlayerId: 'opp-3',
        blackPlayerName: 'Opponent 3',
        blackPlayerRating: 1200,
        gameMode: 'PVP',
        initialTimeMs: 60000,
        incrementMs: 0,
      });
      await gameRepo.update(g3.id, { status: 'COMPLETED', result: 'DRAW' });

      const { usersService } = await import('../src/modules/users/users.service');
      const stats = await usersService.getUserStats(testUser.id);

      expect(stats.gamesPlayed).toBe(3);
      expect(stats.wins).toBe(1);
      expect(stats.losses).toBe(1);
      expect(stats.draws).toBe(1);
      expect(stats.winRate).toBe(33); // 1 / 3 = 33%
    });
  });
});
