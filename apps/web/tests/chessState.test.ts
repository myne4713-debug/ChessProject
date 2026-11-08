import { describe, it, expect } from 'vitest';
import { Chess } from 'chess.js';
import { STARTING_FEN, AI_SYSTEM_USER_ID, GUEST_SYSTEM_USER_ID } from '@online-chess/shared';

describe('Web App: Client Chess Engine & State Sync', () => {
  it('should initialize board with valid standard chess starting FEN', () => {
    const chess = new Chess(STARTING_FEN);
    expect(chess.turn()).toBe('w');
    expect(chess.inCheck()).toBe(false);
    expect(chess.moves().length).toBe(20);
  });

  it('should support optimistic move execution and rollback', () => {
    const chess = new Chess(STARTING_FEN);

    // Optimistically execute e2 -> e4
    const move = chess.move({ from: 'e2', to: 'e4' });
    expect(move).toBeDefined();
    expect(move?.san).toBe('e4');
    expect(chess.turn()).toBe('b');

    // Rollback move on server error
    const undone = chess.undo();
    expect(undone).toBeDefined();
    expect(chess.fen()).toBe(STARTING_FEN);
    expect(chess.turn()).toBe('w');
  });

  it('should identify AI and Guest system player IDs', () => {
    expect(AI_SYSTEM_USER_ID).toBe('00000000-0000-0000-0000-000000000001');
    expect(GUEST_SYSTEM_USER_ID).toBe('00000000-0000-0000-0000-000000000002');

    const isAiPlayer = (id?: string | null) => id === 'ai-engine' || id === AI_SYSTEM_USER_ID;
    expect(isAiPlayer(AI_SYSTEM_USER_ID)).toBe(true);
    expect(isAiPlayer('ai-engine')).toBe(true);
    expect(isAiPlayer('human-uuid')).toBe(false);
  });
});
