import { describe, it, expect } from 'vitest';
import { Chess } from 'chess.js';
import { findKingSquare } from '../src/lib/chessUtils';

describe('chessUtils - findKingSquare', () => {
  it('identifies white king on e1 and black king on e8 at game start', () => {
    const chess = new Chess();
    expect(findKingSquare(chess, 'w')).toBe('e1');
    expect(findKingSquare(chess, 'b')).toBe('e8');
  });

  it('correctly tracks king square after movement', () => {
    const chess = new Chess();
    chess.move('e4');
    chess.move('e5');
    chess.move('Ke2'); // White king moves to e2
    expect(findKingSquare(chess, 'w')).toBe('e2');
    expect(findKingSquare(chess, 'b')).toBe('e8');
  });

  it('detects check status and king location in Scholar Mate sequence', () => {
    const chess = new Chess();
    chess.move('e4');
    chess.move('e5');
    chess.move('Qh5');
    chess.move('Nc6');
    chess.move('Bc4');
    chess.move('Nf6');
    chess.move('Qxf7#'); // Checkmate against black king on e8
    expect(chess.inCheck()).toBe(true);
    expect(findKingSquare(chess, 'b')).toBe('e8');
  });
});
