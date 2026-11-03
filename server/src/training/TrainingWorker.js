import { parentPort } from 'node:worker_threads';
import { executeTrainingTask } from './BotTrainer.js';

const evaluationTables = new Map();
parentPort.on('message', (task) => {
  if (task.control === 'reset-evaluation-cache') { evaluationTables.clear(); return; }
  try {
    if (task.evaluationTables) {
      for (const [id, table] of task.evaluationTables.additions) evaluationTables.set(id, table);
      task.tables = new Map(task.evaluationTables.references.map(([seat, id]) => {
        if (!evaluationTables.has(id)) throw new Error(`Missing evaluation table: ${id}`);
        return [seat, evaluationTables.get(id)];
      }));
    }
    parentPort.postMessage({ result: executeTrainingTask(task, (progress) => parentPort.postMessage({ progress })) });
  } catch (error) {
    parentPort.postMessage({ error: error.stack || error.message });
  }
});
