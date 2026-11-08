import { parentPort } from 'worker_threads';
import { CustomChessAI } from './chessAi.service.js';

const ai = new CustomChessAI();

parentPort?.on('message', async (task: { id: string; fen: string; difficulty: any }) => {
  if (!task || !task.id) return;
  try {
    const move = await ai.chooseMove(task.fen, task.difficulty);
    parentPort?.postMessage({ id: task.id, success: true, move });
  } catch (err: any) {
    parentPort?.postMessage({
      id: task.id,
      success: false,
      error: err?.message || String(err),
    });
  }
});
