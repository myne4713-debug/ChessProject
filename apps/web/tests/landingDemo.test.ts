import { describe, it, expect } from 'vitest';
import { Chess } from 'chess.js';
import { DEMO_BOARDS, DEMO_MOVES } from '../src/features/home/demoBoards';

describe('Landing Demo Boards', () => {
  it('matches chess.js board state piece-for-piece at every step 0..10', () => {
    expect(DEMO_BOARDS.length).toBe(DEMO_MOVES.length + 1);

    const chess = new Chess();
    for (let step = 0; step <= DEMO_MOVES.length; step++) {
      if (step > 0) {
        chess.move(DEMO_MOVES[step - 1].san);
      }

      const expected = chess.board();
      const actual = DEMO_BOARDS[step];

      expect(actual.length).toBe(8);
      for (let r = 0; r < 8; r++) {
        expect(actual[r].length).toBe(8);
        for (let c = 0; c < 8; c++) {
          const expPiece = expected[r][c];
          const actPiece = actual[r][c];
          if (expPiece === null) {
            expect(actPiece).toBeNull();
          } else {
            expect(actPiece).toEqual({
              type: expPiece.type,
              color: expPiece.color,
            });
          }
        }
      }
    }
  });
});
