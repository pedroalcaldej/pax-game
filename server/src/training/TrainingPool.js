import { Worker } from 'node:worker_threads';

/** Fixed-size workers; task results retain submission order, regardless of completion order. */
export class TrainingPool {
  constructor(size, executeLocally) {
    this.executeLocally = executeLocally;
    this.queue = [];
    this.workers = [];
    this.failure = null;
    this.simulatedGames = 0;
    this.tableIds = new WeakMap();
    this.nextTableId = 1;
    if (size > 1) {
      for (let index = 0; index < size; index += 1) {
        const worker = new Worker(new URL('./TrainingWorker.js', import.meta.url));
        const slot = { worker, pending: null, cachedTables: new Set() };
        worker.on('message', ({ result, error, progress }) => {
          const pending = slot.pending;
          if (!pending) return;
          if (progress) { pending.onProgress?.(progress); return; }
          slot.pending = null;
          if (error) pending.reject(new Error(error));
          else { this.count(pending.task); pending.resolve(result); }
          this.dispatch();
        });
        worker.on('error', (error) => this.fail(error));
        worker.on('exit', (code) => {
          if (code !== 0 && !this.closing) this.fail(new Error(`Training worker exited: ${code}`));
        });
        this.workers.push(slot);
      }
    }
  }

  fail(error) {
    this.failure = error;
    for (const slot of this.workers) {
      slot.pending?.reject(error);
      slot.pending = null;
    }
    for (const task of this.queue.splice(0)) task.reject(error);
  }

  dispatch() {
    for (const slot of this.workers) {
      if (!slot.pending && this.queue.length) {
        slot.pending = this.queue.shift();
        slot.worker.postMessage(this.encodeEvaluationTask(slot.pending.task, slot));
      }
    }
  }

  // Evaluation tables are immutable within a batch of matches. Each model is
  // cloned once per worker instead of once per fixture. Clear between evaluations
  // to bound memory and make mutations between separate evaluations safe.
  resetEvaluationCache() {
    for (const slot of this.workers) {
      slot.cachedTables.clear();
      slot.worker.postMessage({ control: 'reset-evaluation-cache' });
    }
  }

  encodeEvaluationTask(task, slot) {
    if (task.kind !== 'simulate' || !(task.tables instanceof Map)) return task;
    const additions = [];
    const references = [...task.tables].map(([seat, table]) => {
      let id = this.tableIds.get(table);
      if (!id) { id = this.nextTableId++; this.tableIds.set(table, id); }
      if (!slot.cachedTables.has(id)) {
        additions.push([id, table]);
        slot.cachedTables.add(id);
      }
      return [seat, id];
    });
    const { tables, ...rest } = task;
    return { ...rest, evaluationTables: { additions, references } };
  }

  count(task) {
    this.simulatedGames += task.kind === 'train' ? task.games : 1;
  }

  run(task, onProgress) {
    if (this.failure) return Promise.reject(this.failure);
    if (!this.workers.length) return Promise.resolve().then(() => {
      const result = this.executeLocally(task, onProgress);
      this.count(task);
      return result;
    });
    return new Promise((resolve, reject) => {
      this.queue.push({ task, resolve, reject, onProgress });
      this.dispatch();
    });
  }

  async close() {
    this.closing = true;
    await Promise.all(this.workers.map(({ worker }) => worker.terminate()));
  }
}
