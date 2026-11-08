import { GameState, MoveData, GameMode, GameStatusType, GameResultType, TerminationReasonType, PieceColor } from '@online-chess/shared';
import { RatingChangeResult } from '../ratings/ratings.service';

export interface GameRecord {
  id: string;
  whitePlayerId?: string | null;
  whitePlayerName: string;
  whitePlayerRating: number;
  blackPlayerId?: string | null;
  blackPlayerName?: string | null;
  blackPlayerRating?: number | null;
  gameMode: GameMode;
  aiDifficulty?: string | null;
  status: GameStatusType;
  result?: GameResultType | null;
  terminationReason?: TerminationReasonType | null;
  initialTimeMs: number;
  incrementMs: number;
  whiteRemainingMs: number;
  blackRemainingMs: number;
  currentTurn: PieceColor;
  currentFen: string;
  positionVersion: number;
  drawOfferedBy?: string | null;
  lastMoveTimestamp?: number | null;
  positionHistory?: string[];
  startedAt?: Date | null;
  endedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ExecuteMoveTransactionParams {
  gameId: string;
  expectedVersion: number;
  moveData: Omit<MoveData, 'id' | 'createdAt'>;
  gameUpdate: Partial<GameRecord>;
  ratingCalculation?: {
    whitePlayerId: string;
    blackPlayerId: string;
    result: GameResultType;
  };
}

export interface ExecuteMoveTransactionResult {
  move: MoveData;
  game: GameRecord;
  ratingChanges?: RatingChangeResult;
}

export interface IGameRepository {
  create(data: {
    whitePlayerId?: string | null;
    whitePlayerName: string;
    whitePlayerRating: number;
    blackPlayerId?: string | null;
    blackPlayerName?: string | null;
    blackPlayerRating?: number | null;
    gameMode: GameMode;
    aiDifficulty?: string | null;
    initialTimeMs: number;
    incrementMs: number;
  }): Promise<GameRecord>;
  findById(id: string): Promise<GameRecord | null>;
  update(id: string, data: Partial<GameRecord>): Promise<GameRecord>;
  updateWithVersion(
    id: string,
    expectedVersion: number,
    data: Partial<GameRecord>
  ): Promise<GameRecord>;
  addMove(move: Omit<MoveData, 'id' | 'createdAt'>): Promise<MoveData>;
  getMovesByGameId(gameId: string): Promise<MoveData[]>;
  getUserGames(userId: string, skip?: number, take?: number): Promise<{ games: GameRecord[]; total: number }>;
  getUserStats(userId: string): Promise<{
    gamesPlayed: number;
    wins: number;
    draws: number;
    losses: number;
    winRate: number;
  }>;
  executeMoveTransaction(params: ExecuteMoveTransactionParams): Promise<ExecuteMoveTransactionResult>;
}
