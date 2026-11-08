import { describe, it, expect } from 'vitest';
import { gameService } from '../src/modules/games/games.service';
import { authService } from '../src/modules/auth/auth.service';
import { chatService } from '../src/modules/chat/chat.service';
import { matchmakingService } from '../src/modules/matchmaking/matchmaking.service';

describe('Phase 4 - Game Service & Authoritative State Tests', () => {
  let whiteUserId: string;
  let blackUserId: string;

  it('should initialize two players and create a game', async () => {
    const whiteAuth = await authService.register({
      username: 'player_white',
      email: 'white@chess.local',
      password: 'Password123!',
    });
    const blackAuth = await authService.register({
      username: 'player_black',
      email: 'black@chess.local',
      password: 'Password123!',
    });

    whiteUserId = whiteAuth.user.id;
    blackUserId = blackAuth.user.id;

    const game = await gameService.createGame({
      whitePlayerId: whiteUserId,
      whitePlayerName: 'player_white',
      whitePlayerRating: 1200,
      blackPlayerId: blackUserId,
      blackPlayerName: 'player_black',
      blackPlayerRating: 1200,
      gameMode: 'PVP',
      initialTimeMs: 5 * 60 * 1000,
      incrementMs: 3 * 1000,
    });

    expect(game.id).toBeDefined();
    expect(game.status).toBe('IN_PROGRESS');
    expect(game.currentTurn).toBe('w');
    expect(game.positionVersion).toBe(0);
  });

  it('should process legal moves and update clocks and position version', async () => {
    const game = await gameService.createGame({
      whitePlayerId: whiteUserId,
      whitePlayerName: 'player_white',
      whitePlayerRating: 1200,
      blackPlayerId: blackUserId,
      blackPlayerName: 'player_black',
      blackPlayerRating: 1200,
      gameMode: 'PVP',
      initialTimeMs: 5 * 60 * 1000,
      incrementMs: 3 * 1000,
    });

    // 1. e4 (White)
    const move1 = await gameService.makeMove({
      gameId: game.id,
      playerId: whiteUserId,
      from: 'e2',
      to: 'e4',
      expectedVersion: 0,
    });

    expect(move1.moveResult.move.san).toBe('e4');
    expect(move1.moveResult.positionVersion).toBe(1);
    expect(move1.moveResult.currentTurn).toBe('b');

    // 1... e5 (Black)
    const move2 = await gameService.makeMove({
      gameId: game.id,
      playerId: blackUserId,
      from: 'e7',
      to: 'e5',
      expectedVersion: 1,
    });

    expect(move2.moveResult.move.san).toBe('e5');
    expect(move2.moveResult.positionVersion).toBe(2);
    expect(move2.moveResult.currentTurn).toBe('w');
  });

  it('should reject stale moves with positionVersion mismatch', async () => {
    const game = await gameService.createGame({
      whitePlayerId: whiteUserId,
      whitePlayerName: 'player_white',
      whitePlayerRating: 1200,
      blackPlayerId: blackUserId,
      blackPlayerName: 'player_black',
      blackPlayerRating: 1200,
      gameMode: 'PVP',
      initialTimeMs: 5 * 60 * 1000,
      incrementMs: 0,
    });

    // Move 1
    await gameService.makeMove({
      gameId: game.id,
      playerId: whiteUserId,
      from: 'e2',
      to: 'e4',
      expectedVersion: 0,
    });

    // Submitting with expectedVersion 0 again should fail (concurrency / race condition protection)
    await expect(
      gameService.makeMove({
        gameId: game.id,
        playerId: blackUserId,
        from: 'e7',
        to: 'e5',
        expectedVersion: 0,
      })
    ).rejects.toThrow('Trạng thái bàn cờ đã thay đổi');
  });

  it('should reject moving when it is not the players turn', async () => {
    const game = await gameService.createGame({
      whitePlayerId: whiteUserId,
      whitePlayerName: 'player_white',
      whitePlayerRating: 1200,
      blackPlayerId: blackUserId,
      blackPlayerName: 'player_black',
      blackPlayerRating: 1200,
      gameMode: 'PVP',
      initialTimeMs: 5 * 60 * 1000,
      incrementMs: 0,
    });

    // Black tries to move on White's turn
    await expect(
      gameService.makeMove({
        gameId: game.id,
        playerId: blackUserId,
        from: 'e7',
        to: 'e5',
        expectedVersion: 0,
      })
    ).rejects.toThrow('Không phải lượt đi của bạn');
  });

  it('should handle resignation and update ELO rating', async () => {
    const game = await gameService.createGame({
      whitePlayerId: whiteUserId,
      whitePlayerName: 'player_white',
      whitePlayerRating: 1200,
      blackPlayerId: blackUserId,
      blackPlayerName: 'player_black',
      blackPlayerRating: 1200,
      gameMode: 'PVP',
      initialTimeMs: 5 * 60 * 1000,
      incrementMs: 0,
    });

    const resignResult = await gameService.resign(game.id, whiteUserId);
    expect(resignResult.game.status).toBe('COMPLETED');
    expect(resignResult.game.result).toBe('BLACK_WON');
    expect(resignResult.game.terminationReason).toBe('RESIGNATION');
    expect(resignResult.ratingChanges).toBeDefined();
    expect(resignResult.ratingChanges?.blackRatingChange).toBeGreaterThan(0);
    expect(resignResult.ratingChanges?.whiteRatingChange).toBeLessThan(0);
  });

  it('should handle draw offer and acceptance', async () => {
    const game = await gameService.createGame({
      whitePlayerId: whiteUserId,
      whitePlayerName: 'player_white',
      whitePlayerRating: 1200,
      blackPlayerId: blackUserId,
      blackPlayerName: 'player_black',
      blackPlayerRating: 1200,
      gameMode: 'PVP',
      initialTimeMs: 5 * 60 * 1000,
      incrementMs: 0,
    });

    // White offers draw
    await gameService.offerDraw(game.id, whiteUserId);
    // Black accepts draw
    const drawRes = await gameService.acceptDraw(game.id, blackUserId);

    expect(drawRes.game.status).toBe('COMPLETED');
    expect(drawRes.game.result).toBe('DRAW');
    expect(drawRes.game.terminationReason).toBe('MUTUAL_AGREEMENT');
  });

  it('should reconstruct move replay step by step', async () => {
    const game = await gameService.createGame({
      whitePlayerId: whiteUserId,
      whitePlayerName: 'player_white',
      whitePlayerRating: 1200,
      blackPlayerId: blackUserId,
      blackPlayerName: 'player_black',
      blackPlayerRating: 1200,
      gameMode: 'PVP',
      initialTimeMs: 5 * 60 * 1000,
      incrementMs: 0,
    });

    await gameService.makeMove({
      gameId: game.id,
      playerId: whiteUserId,
      from: 'e2',
      to: 'e4',
      expectedVersion: 0,
    });
    await gameService.makeMove({
      gameId: game.id,
      playerId: blackUserId,
      from: 'e7',
      to: 'e5',
      expectedVersion: 1,
    });

    const replay = await gameService.getReplay(game.id);
    expect(replay.history.length).toBe(3); // Start, move 1, move 2
    expect(replay.history[0].ply).toBe(0);
    expect(replay.history[1].san).toBe('e4');
    expect(replay.history[2].san).toBe('e5');
  });

  it('should allow resignation in AI games with guest-human player', async () => {
    const game = await gameService.createGame({
      whitePlayerId: 'guest-human',
      whitePlayerName: 'Bạn',
      whitePlayerRating: 1200,
      blackPlayerId: 'ai-engine',
      blackPlayerName: 'AI (MEDIUM)',
      blackPlayerRating: 1500,
      gameMode: 'AI',
      initialTimeMs: 1000 * 60 * 10,
      incrementMs: 0,
    });

    const result = await gameService.resign(game.id, 'guest-human');
    expect(result.game.status).toBe('COMPLETED');
    expect(result.game.result).toBe('BLACK_WON');
    expect(result.game.terminationReason).toBe('RESIGNATION');
  });

  it('should reject unauthenticated move in PvP match (Finding C-02)', async () => {
    const game = await gameService.createGame({
      whitePlayerId: whiteUserId,
      whitePlayerName: 'player_white',
      whitePlayerRating: 1200,
      blackPlayerId: blackUserId,
      blackPlayerName: 'player_black',
      blackPlayerRating: 1200,
      gameMode: 'PVP',
      initialTimeMs: 5 * 60 * 1000,
      incrementMs: 0,
    });

    await expect(
      gameService.makeMove({
        gameId: game.id,
        playerId: undefined as any,
        from: 'e2',
        to: 'e4',
        expectedVersion: 0,
      })
    ).rejects.toThrow('Yêu cầu đăng nhập');
  });

  it('should enforce clock timeout claims and award forfeit win (Finding C-03)', async () => {
    const game = await gameService.createGame({
      whitePlayerId: whiteUserId,
      whitePlayerName: 'player_white',
      whitePlayerRating: 1200,
      blackPlayerId: blackUserId,
      blackPlayerName: 'player_black',
      blackPlayerRating: 1200,
      gameMode: 'PVP',
      initialTimeMs: 50, // 50ms fast expiration
      incrementMs: 0,
    });

    // Claimant attempts before timeout -> rejected
    await expect(gameService.claimTimeout(game.id, blackUserId)).rejects.toThrow(
      'Đối thủ chưa hết thời gian'
    );

    // Wait 80ms for White's clock to expire
    await new Promise((resolve) => setTimeout(resolve, 80));

    const timeoutRes = await gameService.claimTimeout(game.id, blackUserId);
    expect(timeoutRes.moveResult.isGameOver).toBe(true);
    expect(timeoutRes.moveResult.result).toBe('BLACK_WON');
    expect(timeoutRes.moveResult.terminationReason).toBe('TIMEOUT');
  });

  it('should detect threefold repetition draw after move cycle (Finding H-04)', async () => {
    const game = await gameService.createGame({
      whitePlayerId: whiteUserId,
      whitePlayerName: 'player_white',
      whitePlayerRating: 1200,
      blackPlayerId: blackUserId,
      blackPlayerName: 'player_black',
      blackPlayerRating: 1200,
      gameMode: 'PVP',
      initialTimeMs: 5 * 60 * 1000,
      incrementMs: 0,
    });

    // 1. Nf3 Nf6
    await gameService.makeMove({ gameId: game.id, playerId: whiteUserId, from: 'g1', to: 'f3', expectedVersion: 0 });
    await gameService.makeMove({ gameId: game.id, playerId: blackUserId, from: 'g8', to: 'f6', expectedVersion: 1 });
    // 2. Ng1 Ng8 (Position appears 2nd time)
    await gameService.makeMove({ gameId: game.id, playerId: whiteUserId, from: 'f3', to: 'g1', expectedVersion: 2 });
    await gameService.makeMove({ gameId: game.id, playerId: blackUserId, from: 'f6', to: 'g8', expectedVersion: 3 });
    // 3. Nf3 Nf6
    await gameService.makeMove({ gameId: game.id, playerId: whiteUserId, from: 'g1', to: 'f3', expectedVersion: 4 });
    await gameService.makeMove({ gameId: game.id, playerId: blackUserId, from: 'g8', to: 'f6', expectedVersion: 5 });
    // 4. Ng1 Ng8 (Position appears 3rd time -> Threefold Repetition Draw!)
    await gameService.makeMove({ gameId: game.id, playerId: whiteUserId, from: 'f3', to: 'g1', expectedVersion: 6 });
    const finalMove = await gameService.makeMove({
      gameId: game.id,
      playerId: blackUserId,
      from: 'f6',
      to: 'g8',
      expectedVersion: 7,
    });

    expect(finalMove.moveResult.isGameOver).toBe(true);
    expect(finalMove.moveResult.result).toBe('DRAW');
    expect(finalMove.moveResult.terminationReason).toBe('THREEFOLD_REPETITION');
  });

  it('should sanitize chat messages against HTML injection (Finding L-02)', async () => {
    const msg = await chatService.addMessage({
      gameId: 'test-game-id',
      senderId: whiteUserId,
      senderUsername: 'player_white',
      content: "<script>alert('pwned')</script><b>Hello</b>",
    });

    expect(msg.content).not.toContain('<script>');
    expect(msg.content).toContain('&lt;script&gt;');
    expect(msg.content).toContain('&#x27;pwned&#x27;');
  });

  it('should respect Elo rating windows in matchmaking (Finding M-04)', () => {
    // High elo player enters queue
    const res1 = matchmakingService.addToQueue({
      userId: 'pro-player',
      username: 'Magnus',
      eloRating: 2800,
      initialTimeMs: 180000,
      incrementMs: 2000,
      joinedAt: Date.now(),
      socketId: 'sock-1',
    });
    expect(res1.matched).toBe(false);

    // Beginner enters queue simultaneously with same time control
    const res2 = matchmakingService.addToQueue({
      userId: 'beginner-player',
      username: 'Beginner',
      eloRating: 500,
      initialTimeMs: 180000,
      incrementMs: 2000,
      joinedAt: Date.now(),
      socketId: 'sock-2',
    });
    // Difference is 2300 Elo, base window is 100 Elo -> should NOT match immediately
    expect(res2.matched).toBe(false);

    // Similar elo player enters queue
    const res3 = matchmakingService.addToQueue({
      userId: 'peer-pro-player',
      username: 'Hikaru',
      eloRating: 2780,
      initialTimeMs: 180000,
      incrementMs: 2000,
      joinedAt: Date.now(),
      socketId: 'sock-3',
    });
    // Difference with Magnus is 20 Elo -> should MATCH!
    expect(res3.matched).toBe(true);
    expect(res3.opponent?.username).toBe('Magnus');
  });

  it('C-01 Fix: should create and play AI game using system IDs without FK violation', async () => {
    const aiGame = await gameService.createGame({
      whitePlayerId: '00000000-0000-0000-0000-000000000002',
      whitePlayerName: 'Khách',
      whitePlayerRating: 1200,
      blackPlayerId: '00000000-0000-0000-0000-000000000001',
      blackPlayerName: 'StockAI',
      blackPlayerRating: 1500,
      gameMode: 'AI',
      initialTimeMs: 300000,
      incrementMs: 0,
    });

    expect(aiGame.id).toBeDefined();
    expect(aiGame.whitePlayerId).toBe('00000000-0000-0000-0000-000000000002');
    expect(aiGame.blackPlayerId).toBe('00000000-0000-0000-0000-000000000001');

    // Move e4 by human guest
    const moveRes = await gameService.makeMove({
      gameId: aiGame.id,
      playerId: '00000000-0000-0000-0000-000000000002',
      from: 'e2',
      to: 'e4',
      expectedVersion: 0,
    });
    expect(moveRes.moveResult.positionVersion).toBe(1);
    expect(moveRes.moveResult.fen).toBeDefined();
  });

  it('C-02 Fix: should execute move transaction atomically and reject phantom moves on version conflict', async () => {
    const game = await gameService.createGame({
      whitePlayerId: whiteUserId,
      whitePlayerName: 'player_white',
      whitePlayerRating: 1200,
      blackPlayerId: blackUserId,
      blackPlayerName: 'player_black',
      blackPlayerRating: 1200,
      gameMode: 'PVP',
      initialTimeMs: 300000,
      incrementMs: 0,
    });

    // Valid move 1
    await gameService.makeMove({
      gameId: game.id,
      playerId: whiteUserId,
      from: 'd2',
      to: 'd4',
      expectedVersion: 0,
    });

    // Stale version move attempt with wrong version 0 (current is 1)
    await expect(
      gameService.makeMove({
        gameId: game.id,
        playerId: blackUserId,
        from: 'd7',
        to: 'd5',
        expectedVersion: 0,
      })
    ).rejects.toThrow('Trạng thái bàn cờ đã thay đổi');

    // Ensure move count is strictly 1 (no phantom moves inserted)
    const moves = await gameService['gameRepo'].getMovesByGameId(game.id);
    expect(moves.length).toBe(1);
    expect(moves[0].san).toBe('d4');
  });
});
