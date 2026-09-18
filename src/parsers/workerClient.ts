import { LIMITS } from '../security/limits.ts';

/** Every untrusted parsing job has its own disposable worker and hard deadline.
 * No synchronous fallback: browsers without workers fail closed. */
export function importJob<T>(request: object, signal?: AbortSignal, createWorker = () => new Worker(new URL('./importWorker.ts', import.meta.url), { type: 'module' }), timeoutMs = LIMITS.timeoutMs): Promise<T> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(new Error('Import cancelled.')); return; }
    const worker = createWorker();
    const finish = (error?: Error, result?: T) => {
      clearTimeout(timer); signal?.removeEventListener('abort', abort); worker.terminate();
      if (error) reject(error); else resolve(result!);
    };
    const abort = () => finish(new Error('Import cancelled.'));
    const timer = setTimeout(() => finish(new Error('Import exceeded the 15-second time limit. Export a smaller data table.')), timeoutMs);
    signal?.addEventListener('abort', abort, { once: true });
    worker.onmessage = ({ data }) => finish(data.error ? new Error(data.error) : undefined, data.result);
    worker.onerror = () => finish(new Error('Import worker failed. The file was not imported.'));
    worker.onmessageerror = () => finish(new Error('Invalid import worker response.'));
    try { worker.postMessage(request); } catch (error) { finish(error instanceof Error ? error : new Error('Import failed.')); }
  });
}
