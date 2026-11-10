import { Chess, Square } from 'chess.js';

/**
 * Finds the board square ('e1', 'e8', etc.) of the king for a given color.
 */
export function findKingSquare(chess: Chess, color: 'w' | 'b'): Square | null {
  const board = chess.board();
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (piece && piece.type === 'k' && piece.color === color) {
        const file = String.fromCharCode('a'.charCodeAt(0) + c);
        const rank = 8 - r;
        return `${file}${rank}` as Square;
      }
    }
  }
  return null;
}
