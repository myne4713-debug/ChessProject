import type { CSSProperties } from 'react';

export const CHESS_BOARD_STYLE: Record<string, string | number> = {
  borderRadius: '12px',
  boxShadow: 'var(--chess-shadow-board)',
};

export const CHESS_BOARD_STYLE_ROUNDED: Record<string, string | number> = {
  borderRadius: '14px',
};

export const CHESS_DARK_SQUARE_STYLE: Record<string, string> = {
  backgroundColor: 'var(--chess-board-dark)',
};

export const CHESS_LIGHT_SQUARE_STYLE: Record<string, string> = {
  backgroundColor: 'var(--chess-board-light)',
};

export interface SquareHighlightOptions {
  lastMoveSquares: { from?: string; to?: string };
  selectedSquare: string | null;
  showHints: boolean;
  possibleMoves: readonly string[];
  captureMoves: ReadonlySet<string>;
  kingInCheckSquare: string | null;
}

/**
 * Compute react-chessboard square styles strictly from CSS design tokens.
 */
export function buildSquareHighlightStyles({
  lastMoveSquares,
  selectedSquare,
  showHints,
  possibleMoves,
  captureMoves,
  kingInCheckSquare,
}: SquareHighlightOptions): Record<string, CSSProperties> {
  const styles: Record<string, CSSProperties> = {};

  if (lastMoveSquares.from) {
    styles[lastMoveSquares.from] = { backgroundColor: 'var(--chess-board-last-from)' };
  }
  if (lastMoveSquares.to) {
    styles[lastMoveSquares.to] = { backgroundColor: 'var(--chess-board-last-to)' };
  }

  if (selectedSquare) {
    styles[selectedSquare] = {
      backgroundColor: 'var(--chess-board-selected-bg)',
      boxShadow: 'inset 0 0 0 2px var(--chess-board-selected-ring)',
    };
  }

  if (showHints) {
    possibleMoves.forEach((sq) => {
      if (captureMoves.has(sq)) {
        styles[sq] = {
          background:
            'radial-gradient(circle, transparent 56%, var(--chess-board-capture-ring) 57%, var(--chess-board-capture-ring) 72%, transparent 73%)',
          cursor: 'pointer',
          borderRadius: '50%',
        };
      } else {
        styles[sq] = {
          background:
            'radial-gradient(circle, var(--chess-board-hint-dot) 23%, transparent 24%)',
          cursor: 'pointer',
          borderRadius: '50%',
        };
      }
    });
  }

  if (kingInCheckSquare) {
    styles[kingInCheckSquare] = {
      background:
        'radial-gradient(ellipse at center, var(--chess-board-check-inner) 0%, var(--chess-board-check-outer) 45%, transparent 78%)',
    };
  }

  return styles;
}
