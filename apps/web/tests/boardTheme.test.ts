import { describe, it, expect } from 'vitest';
import {
  CHESS_DARK_SQUARE_STYLE,
  CHESS_LIGHT_SQUARE_STYLE,
  buildSquareHighlightStyles,
} from '../src/lib/boardTheme';

describe('Web App: boardTheme Token Helpers', () => {
  it('exposes CSS variable-backed board square defaults', () => {
    expect(CHESS_DARK_SQUARE_STYLE.backgroundColor).toBe('var(--chess-board-dark)');
    expect(CHESS_LIGHT_SQUARE_STYLE.backgroundColor).toBe('var(--chess-board-light)');
  });

  it('builds token-based square highlight styles for moves, hints, and check', () => {
    const styles = buildSquareHighlightStyles({
      lastMoveSquares: { from: 'e2', to: 'e4' },
      selectedSquare: 'd2',
      showHints: true,
      possibleMoves: ['d3', 'd4', 'e3'],
      captureMoves: new Set(['e3']),
      kingInCheckSquare: 'e1',
    });

    expect(styles.e2).toEqual({ backgroundColor: 'var(--chess-board-last-from)' });
    expect(styles.e4).toEqual({ backgroundColor: 'var(--chess-board-last-to)' });
    expect(styles.d2).toEqual({
      backgroundColor: 'var(--chess-board-selected-bg)',
      boxShadow: 'inset 0 0 0 2px var(--chess-board-selected-ring)',
    });
    expect(String(styles.d3.background)).toContain('var(--chess-board-hint-dot)');
    expect(String(styles.e3.background)).toContain('var(--chess-board-capture-ring)');
    expect(String(styles.e1.background)).toContain('var(--chess-board-check-inner)');
  });

  it('omits move hint dots when showHints is false', () => {
    const styles = buildSquareHighlightStyles({
      lastMoveSquares: {},
      selectedSquare: 'd2',
      showHints: false,
      possibleMoves: ['d3', 'e3'],
      captureMoves: new Set(['e3']),
      kingInCheckSquare: null,
    });

    expect(styles.d3).toBeUndefined();
    expect(styles.e3).toBeUndefined();
    expect(styles.d2).toBeDefined();
  });
});
