function abortError(message = 'Request cancelled.') {
  const error = new Error(message);
  error.name = 'AbortError';
  return error;
}
function throwIfAborted(signal) {
  if (signal?.aborted) throw signal.reason || abortError();
}
/** Race transports without native AbortSignal support, ignoring late responses. */
function withAbort(promise, signal) {
  if (!signal) return Promise.resolve(promise);
  if (signal.aborted) {
    Promise.resolve(promise).catch(() => {});
    return Promise.reject(signal.reason || abortError());
  }
  return new Promise((resolve, reject) => {
    const onAbort = () => reject(signal.reason || abortError());
    signal.addEventListener('abort', onAbort, { once: true });
    Promise.resolve(promise).then(resolve, reject).finally(() => signal.removeEventListener('abort', onAbort));
  });
}
class TaskManager {
  constructor() { this.controllers = new Set(); this.disposed = false; }
  async run(seconds, work, parentSignal) {
    if (this.disposed) throw abortError('Plugin is unloaded.');
    throwIfAborted(parentSignal);
    const controller = new AbortController();
    this.controllers.add(controller);
    const forwardAbort = () => controller.abort(parentSignal.reason || abortError());
    parentSignal?.addEventListener('abort', forwardAbort, { once: true });
    const timer = setTimeout(() => {
      const error = new Error(`Request timed out (${seconds}s).`);
      error.name = 'TimeoutError';
      controller.abort(error);
    }, seconds * 1000);
    try {
      return await withAbort(Promise.resolve().then(() => {
        throwIfAborted(controller.signal);
        return work(controller.signal);
      }), controller.signal);
    } finally {
      clearTimeout(timer);
      parentSignal?.removeEventListener('abort', forwardAbort);
      this.controllers.delete(controller);
    }
  }
  dispose() {
    this.disposed = true;
    for (const controller of this.controllers) controller.abort(abortError('Plugin is unloaded.'));
    this.controllers.clear();
  }
}
module.exports = { TaskManager, abortError, throwIfAborted, withAbort };
