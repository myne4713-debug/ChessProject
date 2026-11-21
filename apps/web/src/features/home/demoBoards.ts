export interface DemoPiece {
  type: 'p' | 'n' | 'b' | 'r' | 'q' | 'k';
  color: 'w' | 'b';
}

export interface DemoMove {
  san: string;
  from: string;
  to: string;
  evalScore: number;
}

// Famous opening moves (Sicilian Defense - Najdorf Variation)
export const DEMO_MOVES: DemoMove[] = [
  { san: 'e4', from: 'e2', to: 'e4', evalScore: 0.2 },
  { san: 'c5', from: 'c7', to: 'c5', evalScore: 0.3 },
  { san: 'Nf3', from: 'g1', to: 'f3', evalScore: 0.4 },
  { san: 'd6', from: 'd7', to: 'd6', evalScore: 0.3 },
  { san: 'd4', from: 'd2', to: 'd4', evalScore: 0.5 },
  { san: 'cxd4', from: 'c5', to: 'd4', evalScore: 0.4 },
  { san: 'Nxd4', from: 'f3', to: 'd4', evalScore: 0.6 },
  { san: 'Nf6', from: 'g8', to: 'f6', evalScore: 0.5 },
  { san: 'Nc3', from: 'b1', to: 'c3', evalScore: 0.7 },
  { san: 'a6', from: 'a7', to: 'a6', evalScore: 0.6 },
];

// Precomputed FEN piece-placement strings for steps 0..10 (avoids bundling chess.js on LandingPage)
export const DEMO_FENS: readonly string[] = [
  'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR',
  'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR',
  'rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR',
  'rnbqkbnr/pp1ppppp/8/2p5/4P3/5N2/PPPP1PPP/RNBQKB1R',
  'rnbqkbnr/pp2pppp/3p4/2p5/4P3/5N2/PPPP1PPP/RNBQKB1R',
  'rnbqkbnr/pp2pppp/3p4/2p5/3PP3/5N2/PPP2PPP/RNBQKB1R',
  'rnbqkbnr/pp2pppp/3p4/8/3pP3/5N2/PPP2PPP/RNBQKB1R',
  'rnbqkbnr/pp2pppp/3p4/8/3NP3/8/PPP2PPP/RNBQKB1R',
  'rnbqkb1r/pp2pppp/3p1n2/8/3NP3/8/PPP2PPP/RNBQKB1R',
  'rnbqkb1r/pp2pppp/3p1n2/8/3NP3/2N5/PPP2PPP/R1BQKB1R',
  'rnbqkb1r/1p2pppp/p2p1n2/8/3NP3/2N5/PPP2PPP/R1BQKB1R',
];

/**
 * Parse the piece-placement segment of a FEN string into an 8x8 matrix
 * matching `chess.board()` shape without requiring chess.js at runtime.
 */
export function parseFenPlacement(placement: string): (DemoPiece | null)[][] {
  return placement.split('/').map((rank) => {
    const row: (DemoPiece | null)[] = [];
    for (const ch of rank) {
      const emptyCount = Number(ch);
      if (emptyCount >= 1 && emptyCount <= 8) {
        for (let i = 0; i < emptyCount; i++) {
          row.push(null);
        }
      } else {
        const lower = ch.toLowerCase() as DemoPiece['type'];
        row.push({
          type: lower,
          color: ch === lower ? 'b' : 'w',
        });
      }
    }
    return row;
  });
}

export const DEMO_BOARDS: readonly (DemoPiece | null)[][][] = DEMO_FENS.map(parseFenPlacement);
