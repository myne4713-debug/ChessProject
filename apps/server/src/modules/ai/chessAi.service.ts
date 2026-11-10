import { Chess, Move } from 'chess.js';
import { AISearchStats, AIChessMove, AIDifficulty, PieceColor } from '@online-chess/shared';
import { logger } from '../../config/logger';

// Piece material values in centipawns
const PIECE_VALUES: Record<string, number> = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 20000,
};

// Piece-Square Tables (White perspective, rank 8 to rank 1, a to h)
// For black, these are mirrored vertically
const PAWN_PST = [
  0,  0,  0,  0,  0,  0,  0,  0,
 50, 50, 50, 50, 50, 50, 50, 50,
 10, 10, 20, 30, 30, 20, 10, 10,
  5,  5, 10, 25, 25, 10,  5,  5,
  0,  0,  0, 20, 20,  0,  0,  0,
  5, -5,-10,  0,  0,-10, -5,  5,
  5, 10, 10,-20,-20, 10, 10,  5,
  0,  0,  0,  0,  0,  0,  0,  0
];

const KNIGHT_PST = [
 -50,-40,-30,-30,-30,-30,-40,-50,
 -40,-20,  0,  0,  0,  0,-20,-40,
 -30,  0, 10, 15, 15, 10,  0,-30,
 -30,  5, 15, 20, 20, 15,  5,-30,
 -30,  0, 15, 20, 20, 15,  0,-30,
 -30,  5, 10, 15, 15, 10,  5,-30,
 -40,-20,  0,  5,  5,  0,-20,-40,
 -50,-40,-30,-30,-30,-30,-40,-50
];

const BISHOP_PST = [
 -20,-10,-10,-10,-10,-10,-10,-20,
 -10,  0,  0,  0,  0,  0,  0,-10,
 -10,  0,  5, 10, 10,  5,  0,-10,
 -10,  5,  5, 10, 10,  5,  5,-10,
 -10,  0, 10, 10, 10, 10,  0,-10,
 -10, 10, 10, 10, 10, 10, 10,-10,
 -10,  5,  0,  0,  0,  0,  5,-10,
 -20,-10,-10,-10,-10,-10,-10,-20
];

const ROOK_PST = [
  0,  0,  0,  0,  0,  0,  0,  0,
  5, 10, 10, 10, 10, 10, 10,  5,
 -5,  0,  0,  0,  0,  0,  0, -5,
 -5,  0,  0,  0,  0,  0,  0, -5,
 -5,  0,  0,  0,  0,  0,  0, -5,
 -5,  0,  0,  0,  0,  0,  0, -5,
 -5,  0,  0,  0,  0,  0,  0, -5,
  0,  0,  0,  5,  5,  0,  0,  0
];

const QUEEN_PST = [
 -20,-10,-10, -5, -5,-10,-10,-20,
 -10,  0,  0,  0,  0,  0,  0,-10,
 -10,  0,  5,  5,  5,  5,  0,-10,
  -5,  0,  5,  5,  5,  5,  0, -5,
   0,  0,  5,  5,  5,  5,  0, -5,
 -10,  5,  5,  5,  5,  5,  0,-10,
 -10,  0,  5,  0,  0,  0,  0,-10,
 -20,-10,-10, -5, -5,-10,-10,-20
];

const KING_MIDGAME_PST = [
 -30,-40,-40,-50,-50,-40,-40,-30,
 -30,-40,-40,-50,-50,-40,-40,-30,
 -30,-40,-40,-50,-50,-40,-40,-30,
 -30,-40,-40,-50,-50,-40,-40,-30,
 -20,-30,-30,-40,-40,-30,-30,-20,
 -10,-20,-20,-20,-20,-20,-20,-10,
  20, 20,  0,  0,  0,  0, 20, 20,
  20, 30, 10,  0,  0, 10, 30, 20
];

export interface IChessAI {
  chooseMove(fen: string, difficulty?: AIDifficulty): Promise<AIChessMove>;
  evaluatePosition(chess: Chess): number;
  search(
    chess: Chess,
    depth: number,
    alpha: number,
    beta: number,
    isMaximizing: boolean,
    ply: number
  ): number;
  orderMoves(chess: Chess, moves: Move[], pvMove?: Move | null): Move[];
  getSearchStatistics(): AISearchStats;
}

export class CustomChessAI implements IChessAI {
  private static whitePawnFiles = new Int8Array(8);
  private static blackPawnFiles = new Int8Array(8);

  private stats: AISearchStats = {
    depth: 0,
    nodesVisited: 0,
    nodesPruned: 0,
    durationMs: 0,
    score: 0,
    bestMove: '',
  };

  private bestMoveAtRoot: Move | null = null;
  private pvMove: Move | null = null;
  private timeLimitMs = 3000;
  private startTime = 0;
  private isTimeout = false;

  getSearchStatistics(): AISearchStats {
    return { ...this.stats };
  }

  evaluatePosition(chess: Chess): number {
    let whiteScore = 0;
    let blackScore = 0;

    // Fast direct board access without allocating 8x8 arrays (0x88 board representation)
    const internalBoard: any[] = (chess as any)._board;
    CustomChessAI.whitePawnFiles.fill(0);
    CustomChessAI.blackPawnFiles.fill(0);

    for (let r = 0; r < 8; r++) {
      const rowOffset = r << 4;
      for (let c = 0; c < 8; c++) {
        const piece = internalBoard ? internalBoard[rowOffset | c] : null;
        if (!piece) continue;

        const squareIndex = r * 8 + c;
        const mirroredIndex = (7 - r) * 8 + c;
        const val = PIECE_VALUES[piece.type] || 0;

        let pstVal = 0;
        switch (piece.type) {
          case 'p':
            pstVal = piece.color === 'w' ? PAWN_PST[squareIndex] : PAWN_PST[mirroredIndex];
            if (piece.color === 'w') CustomChessAI.whitePawnFiles[c]++;
            else CustomChessAI.blackPawnFiles[c]++;
            break;
          case 'n':
            pstVal = piece.color === 'w' ? KNIGHT_PST[squareIndex] : KNIGHT_PST[mirroredIndex];
            break;
          case 'b':
            pstVal = piece.color === 'w' ? BISHOP_PST[squareIndex] : BISHOP_PST[mirroredIndex];
            break;
          case 'r':
            pstVal = piece.color === 'w' ? ROOK_PST[squareIndex] : ROOK_PST[mirroredIndex];
            break;
          case 'q':
            pstVal = piece.color === 'w' ? QUEEN_PST[squareIndex] : QUEEN_PST[mirroredIndex];
            break;
          case 'k':
            pstVal = piece.color === 'w' ? KING_MIDGAME_PST[squareIndex] : KING_MIDGAME_PST[mirroredIndex];
            break;
        }

        if (piece.color === 'w') {
          whiteScore += val + pstVal;
        } else {
          blackScore += val + pstVal;
        }
      }
    }

    // Pawn structure: penalize doubled pawns using preallocated static typed array
    for (let c = 0; c < 8; c++) {
      const wCount = CustomChessAI.whitePawnFiles[c];
      const bCount = CustomChessAI.blackPawnFiles[c];
      if (wCount > 1) whiteScore -= (wCount - 1) * 20;
      if (bCount > 1) blackScore -= (bCount - 1) * 20;
    }

    // Check bonus
    if (chess.inCheck()) {
      if (chess.turn() === 'w') {
        whiteScore -= 40;
      } else {
        blackScore -= 40;
      }
    }

    return whiteScore - blackScore;
  }

  orderMoves(chess: Chess, moves: Move[], pvMove?: Move | null): Move[] {
    return moves.sort((a, b) => {
      // Prioritize the Principal Variation (PV) move from previous iterative deepening step
      if (pvMove) {
        if (a.from === pvMove.from && a.to === pvMove.to) return -10000;
        if (b.from === pvMove.from && b.to === pvMove.to) return 10000;
      }

      let scoreA = 0;
      let scoreB = 0;

      // MVV-LVA: Most Valuable Victim - Least Valuable Attacker
      if (a.captured) {
        const victimVal = PIECE_VALUES[a.captured] || 0;
        const attackerVal = PIECE_VALUES[a.piece] || 0;
        scoreA += victimVal * 10 - attackerVal;
      }
      if (b.captured) {
        const victimVal = PIECE_VALUES[b.captured] || 0;
        const attackerVal = PIECE_VALUES[b.piece] || 0;
        scoreB += victimVal * 10 - attackerVal;
      }

      // Promotions
      if (a.promotion) scoreA += 800;
      if (b.promotion) scoreB += 800;

      // Checks
      if (a.san && a.san.includes('+')) scoreA += 50;
      if (b.san && b.san.includes('+')) scoreB += 50;

      return scoreB - scoreA;
    });
  }

  private quiescence(
    chess: Chess,
    alpha: number,
    beta: number,
    isMaximizing: boolean,
    qply: number
  ): number {
    this.stats.nodesVisited++;
    const standPat = this.evaluatePosition(chess);

    // Limit quiescence depth to 4 plies to avoid horizon explosion
    if (qply >= 4 || this.isTimeout) {
      return standPat;
    }

    // Fast bitwise time limit guard every 128 nodes
    if ((this.stats.nodesVisited & 127) === 0) {
      if (Date.now() - this.startTime > this.timeLimitMs) {
        this.isTimeout = true;
        return standPat;
      }
    }

    if (isMaximizing) {
      if (standPat >= beta) return beta;
      if (standPat > alpha) alpha = standPat;

      const legalMoves = chess.moves({ verbose: true });
      const captureMoves = legalMoves.filter((m) => !!m.captured || !!m.promotion);
      if (captureMoves.length === 0) return standPat;

      const orderedCaptures = this.orderMoves(chess, captureMoves);

      for (const move of orderedCaptures) {
        chess.move(move);
        const score = this.quiescence(chess, alpha, beta, false, qply + 1);
        chess.undo();

        if (this.isTimeout) break;

        if (score >= beta) {
          this.stats.nodesPruned++;
          return beta;
        }
        if (score > alpha) alpha = score;
      }
      return alpha;
    } else {
      if (standPat <= alpha) return alpha;
      if (standPat < beta) beta = standPat;

      const legalMoves = chess.moves({ verbose: true });
      const captureMoves = legalMoves.filter((m) => !!m.captured || !!m.promotion);
      if (captureMoves.length === 0) return standPat;

      const orderedCaptures = this.orderMoves(chess, captureMoves);

      for (const move of orderedCaptures) {
        chess.move(move);
        const score = this.quiescence(chess, alpha, beta, true, qply + 1);
        chess.undo();

        if (this.isTimeout) break;

        if (score <= alpha) {
          this.stats.nodesPruned++;
          return alpha;
        }
        if (score < beta) beta = score;
      }
      return beta;
    }
  }

  search(
    chess: Chess,
    depth: number,
    alpha: number,
    beta: number,
    isMaximizing: boolean,
    ply: number
  ): number {
    this.stats.nodesVisited++;

    // Fast bitwise time limit guard every 128 nodes
    if ((this.stats.nodesVisited & 127) === 0) {
      if (Date.now() - this.startTime > this.timeLimitMs) {
        this.isTimeout = true;
      }
    }

    if (this.isTimeout) {
      return this.evaluatePosition(chess);
    }

    if (depth <= 0) {
      return this.quiescence(chess, alpha, beta, isMaximizing, 0);
    }

    const legalMoves = chess.moves({ verbose: true });
    if (legalMoves.length === 0) {
      if (chess.inCheck()) {
        return isMaximizing ? -100000 + ply : 100000 - ply;
      }
      return 0; // Stalemate
    }

    if (chess.isDraw()) {
      return 0;
    }

    const orderedMoves = this.orderMoves(chess, legalMoves, ply === 0 ? this.pvMove : null);

    if (isMaximizing) {
      let maxEval = -Infinity;
      for (const move of orderedMoves) {
        chess.move(move);
        const evalScore = this.search(chess, depth - 1, alpha, beta, false, ply + 1);
        chess.undo();

        if (this.isTimeout) break;

        if (evalScore > maxEval) {
          maxEval = evalScore;
          if (ply === 0) {
            this.bestMoveAtRoot = move;
          }
        }

        alpha = Math.max(alpha, evalScore);
        if (beta <= alpha) {
          this.stats.nodesPruned++;
          break; // Beta cutoff
        }
      }
      return maxEval;
    } else {
      let minEval = Infinity;
      for (const move of orderedMoves) {
        chess.move(move);
        const evalScore = this.search(chess, depth - 1, alpha, beta, true, ply + 1);
        chess.undo();

        if (this.isTimeout) break;

        if (evalScore < minEval) {
          minEval = evalScore;
          if (ply === 0) {
            this.bestMoveAtRoot = move;
          }
        }

        beta = Math.min(beta, evalScore);
        if (beta <= alpha) {
          this.stats.nodesPruned++;
          break; // Alpha cutoff
        }
      }
      return minEval;
    }
  }

  async chooseMove(fen: string, difficulty: AIDifficulty = 'MEDIUM'): Promise<AIChessMove> {
    const chess = new Chess(fen);
    const legalMoves = chess.moves({ verbose: true });

    if (legalMoves.length === 0) {
      throw new Error('Không còn nước đi hợp lệ (Hết cờ)');
    }

    let depth = 3;
    let timeLimit = 2500;
    let randomness = 0;

    switch (difficulty) {
      case 'EASY':
        depth = 1;
        timeLimit = 1000;
        randomness = 0.35; // 35% chance to pick any safe legal move
        break;
      case 'MEDIUM':
        depth = 3;
        timeLimit = 2500;
        randomness = 0.05;
        break;
      case 'HARD':
        depth = 4;
        timeLimit = 4000;
        randomness = 0;
        break;
    }

    this.timeLimitMs = timeLimit;
    this.startTime = Date.now();
    this.isTimeout = false;
    this.stats = {
      depth,
      nodesVisited: 0,
      nodesPruned: 0,
      durationMs: 0,
      score: 0,
      bestMove: '',
    };
    this.bestMoveAtRoot = null;
    this.pvMove = null;

    // In Easy mode, if random chance hits, pick a random legal move
    if (randomness > 0 && Math.random() < randomness) {
      const randomMove = legalMoves[Math.floor(Math.random() * legalMoves.length)];
      return {
        from: randomMove.from,
        to: randomMove.to,
        promotion: randomMove.promotion,
        san: randomMove.san,
        score: 0,
        stats: {
          depth: 1,
          nodesVisited: 1,
          nodesPruned: 0,
          durationMs: Date.now() - this.startTime,
          score: 0,
          bestMove: randomMove.san,
        },
      };
    }

    const isWhite = chess.turn() === 'w';
    let chosen: Move = legalMoves[0];
    let bestScore = 0;

    // Iterative Deepening: progressively explore depths 1 to target depth
    for (let currentDepth = 1; currentDepth <= depth; currentDepth++) {
      // Don't start deeper search if more than 65% of budget already spent
      if (currentDepth > 1 && Date.now() - this.startTime > this.timeLimitMs * 0.65) {
        break;
      }

      this.bestMoveAtRoot = null;
      const score = this.search(chess, currentDepth, -Infinity, Infinity, isWhite, 0);

      if (!this.isTimeout && this.bestMoveAtRoot) {
        chosen = this.bestMoveAtRoot;
        bestScore = score;
        this.pvMove = this.bestMoveAtRoot;
        this.stats.depth = currentDepth;
      } else if (this.isTimeout) {
        if (!this.pvMove && this.bestMoveAtRoot) {
          chosen = this.bestMoveAtRoot;
          bestScore = score;
        }
        break;
      }
    }

    if (this.stats.depth === 0) {
      this.stats.depth = depth;
    }

    const durationMs = Date.now() - this.startTime;
    this.stats.durationMs = durationMs;
    this.stats.score = bestScore;
    this.stats.bestMove = chosen.san;

    logger.info(
      `AI (${difficulty}) chose ${chosen.san} [depth: ${this.stats.depth}, nodes: ${this.stats.nodesVisited}, pruned: ${this.stats.nodesPruned}, duration: ${durationMs}ms, score: ${bestScore}]`
    );

    return {
      from: chosen.from,
      to: chosen.to,
      promotion: chosen.promotion,
      san: chosen.san,
      score: bestScore,
      stats: this.stats,
    };
  }
}

export const chessAI = new CustomChessAI();
