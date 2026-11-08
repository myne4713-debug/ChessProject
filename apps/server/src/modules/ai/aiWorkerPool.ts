import { Worker } from 'worker_threads';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { randomUUID } from 'crypto';
import { AIChessMove, AIDifficulty } from '@online-chess/shared';
import { chessAI } from './chessAi.service';
import { logger } from '../../config/logger';
import { AppError } from '../../middleware/errorHandler';

interface WorkerSlot {
  id: number;
  worker: Worker;
  busy: boolean;
  activeTaskId: string | null;
  activeTaskTimer: NodeJS.Timeout | null;
}

interface QueuedTask {
  id: string;
  fen: string;
  difficulty: AIDifficulty;
  resolve: (move: AIChessMove) => void;
  reject: (err: any) => void;
  createdAt: number;
}

export class AIWorkerPool {
  private slots: WorkerSlot[] = [];
  private taskQueue: QueuedTask[] = [];
  private poolSize: number;
  private maxQueueSize: number;
  private taskTimeoutMs: number;
  private nextSlotId = 1;
  private isShuttingDown = false;
  private workerScriptPath: string | null = null;
  private isTypeScript = false;

  constructor(options?: {
    poolSize?: number;
    maxQueueSize?: number;
    taskTimeoutMs?: number;
  }) {
    const cpus = os.cpus()?.length || 2;
    this.poolSize = options?.poolSize ?? Math.max(1, Math.min(4, cpus - 1));
    this.maxQueueSize = options?.maxQueueSize ?? 50;
    this.taskTimeoutMs = options?.taskTimeoutMs ?? 8000;
  }

  private resolveWorkerPath(): string | null {
    if (this.workerScriptPath) return this.workerScriptPath;

    // 1. Look for compiled JS worker in current directory (production)
    const jsWorker = path.resolve(__dirname, 'ai.worker.js');
    if (fs.existsSync(jsWorker)) {
      this.workerScriptPath = jsWorker;
      this.isTypeScript = false;
      return this.workerScriptPath;
    }

    // 2. Look for compiled JS worker in dist directory (dev / test when build exists)
    const candidates = [
      path.resolve(process.cwd(), 'apps/server/dist/modules/ai/ai.worker.js'),
      path.resolve(process.cwd(), 'dist/modules/ai/ai.worker.js'),
      path.resolve(__dirname, '../../../dist/modules/ai/ai.worker.js'),
    ];
    for (const cand of candidates) {
      if (fs.existsSync(cand)) {
        this.workerScriptPath = cand;
        this.isTypeScript = false;
        return this.workerScriptPath;
      }
    }

    // 3. Fallback to TypeScript worker file
    const tsWorker = path.resolve(__dirname, 'ai.worker.ts');
    if (fs.existsSync(tsWorker)) {
      this.workerScriptPath = tsWorker;
      this.isTypeScript = true;
      return this.workerScriptPath;
    }

    return null;
  }

  private spawnWorkerSlot(): WorkerSlot | null {
    const scriptPath = this.resolveWorkerPath();
    if (!scriptPath) {
      logger.warn('AI worker script not found on disk');
      return null;
    }

    try {
      const worker = new Worker(scriptPath, {
        execArgv: this.isTypeScript ? ['--import', 'tsx'] : undefined,
      });

      const slot: WorkerSlot = {
        id: this.nextSlotId++,
        worker,
        busy: false,
        activeTaskId: null,
        activeTaskTimer: null,
      };

      worker.on('message', (message: { id: string; success: boolean; move?: AIChessMove; error?: string }) => {
        if (!message || !message.id) return;
        this.handleTaskCompletion(slot, message);
      });

      worker.on('error', (err) => {
        logger.error(err, `AI Worker #${slot.id} encountered an error`);
        this.recycleSlot(slot, new AppError(500, `AI Worker error: ${err.message}`));
      });

      worker.on('exit', (code) => {
        if (code !== 0 && !this.isShuttingDown) {
          logger.warn(`AI Worker #${slot.id} exited unexpectedly with code ${code}`);
          this.recycleSlot(slot, new AppError(500, `AI Worker stopped with code ${code}`));
        }
      });

      this.slots.push(slot);
      return slot;
    } catch (err) {
      logger.error(err, 'Failed to spawn AI Worker thread');
      return null;
    }
  }

  private recycleSlot(deadSlot: WorkerSlot, errorForActiveTask?: Error): void {
    if (deadSlot.activeTaskTimer) {
      clearTimeout(deadSlot.activeTaskTimer);
      deadSlot.activeTaskTimer = null;
    }

    // Reject current task if any was running on this worker
    if (deadSlot.activeTaskId) {
      const activeId = deadSlot.activeTaskId;
      deadSlot.activeTaskId = null;
      deadSlot.busy = false;

      const waitingTaskIndex = this.taskQueue.findIndex((t) => t.id === activeId);
      if (waitingTaskIndex !== -1) {
        const [task] = this.taskQueue.splice(waitingTaskIndex, 1);
        task.reject(errorForActiveTask || new AppError(500, 'AI Worker terminated unexpectedly'));
      }
    }

    // Remove slot from active slots
    this.slots = this.slots.filter((s) => s.id !== deadSlot.id);
    try {
      deadSlot.worker.terminate();
    } catch {
      // Ignore termination errors on dead workers
    }

    // Respawn replacement worker if not shutting down
    if (!this.isShuttingDown && this.slots.length < this.poolSize) {
      this.spawnWorkerSlot();
      this.processNextTask();
    }
  }

  private handleTaskCompletion(
    slot: WorkerSlot,
    message: { id: string; success: boolean; move?: AIChessMove; error?: string }
  ): void {
    if (slot.activeTaskTimer) {
      clearTimeout(slot.activeTaskTimer);
      slot.activeTaskTimer = null;
    }

    const taskId = slot.activeTaskId;
    slot.busy = false;
    slot.activeTaskId = null;

    if (taskId && taskId === message.id) {
      const taskIndex = this.taskQueue.findIndex((t) => t.id === taskId);
      if (taskIndex !== -1) {
        const [task] = this.taskQueue.splice(taskIndex, 1);
        if (message.success && message.move) {
          task.resolve(message.move);
        } else {
          task.reject(new AppError(500, message.error || 'Tính toán nước đi AI thất bại'));
        }
      }
    }

    // Immediately schedule next task in queue
    this.processNextTask();
  }

  private processNextTask(): void {
    if (this.taskQueue.length === 0) return;

    // Find an idle slot
    const idleSlot = this.slots.find((s) => !s.busy);
    if (!idleSlot) return;

    // Find the next task that hasn't been started
    const nextTask = this.taskQueue.find((t) => {
      return !this.slots.some((s) => s.activeTaskId === t.id);
    });

    if (!nextTask) return;

    idleSlot.busy = true;
    idleSlot.activeTaskId = nextTask.id;

    idleSlot.activeTaskTimer = setTimeout(() => {
      logger.warn(`AI Task ${nextTask.id} timed out after ${this.taskTimeoutMs}ms. Recycling worker #${idleSlot.id}`);
      this.recycleSlot(
        idleSlot,
        new AppError(504, 'Thời gian tính toán nước đi AI vượt quá giới hạn (Timeout)')
      );
    }, this.taskTimeoutMs);

    idleSlot.worker.postMessage({
      id: nextTask.id,
      fen: nextTask.fen,
      difficulty: nextTask.difficulty,
    });
  }

  public async executeMove(fen: string, difficulty: AIDifficulty): Promise<AIChessMove> {
    if (this.isShuttingDown) {
      throw new AppError(503, 'AI Worker Pool đang trong quá trình dừng hoạt động');
    }

    if (this.taskQueue.length >= this.maxQueueSize) {
      throw new AppError(503, 'Hàng đợi AI đang quá tải. Vui lòng thử lại sau.');
    }

    // Ensure worker pool is initialized
    while (this.slots.length < this.poolSize) {
      const slot = this.spawnWorkerSlot();
      if (!slot) break;
    }

    // Fallback if workers could not be spawned (e.g. test environment without tsx)
    if (this.slots.length === 0) {
      logger.warn('AI Worker threads unavailable, running computation in isolated tick');
      return await chessAI.chooseMove(fen, difficulty);
    }

    return new Promise<AIChessMove>((resolve, reject) => {
      const task: QueuedTask = {
        id: randomUUID(),
        fen,
        difficulty,
        resolve,
        reject,
        createdAt: Date.now(),
      };

      this.taskQueue.push(task);
      this.processNextTask();
    });
  }

  public destroy(): void {
    this.isShuttingDown = true;
    for (const slot of this.slots) {
      if (slot.activeTaskTimer) clearTimeout(slot.activeTaskTimer);
      try {
        slot.worker.terminate();
      } catch {
        // Ignore
      }
    }
    this.slots = [];
    for (const task of this.taskQueue) {
      task.reject(new AppError(503, 'AI Worker Pool đã bị dừng'));
    }
    this.taskQueue = [];
  }
}

export const aiWorkerPool = new AIWorkerPool();

export async function runAIMoveInWorker(
  fen: string,
  difficulty: AIDifficulty
): Promise<AIChessMove> {
  return aiWorkerPool.executeMove(fen, difficulty);
}
