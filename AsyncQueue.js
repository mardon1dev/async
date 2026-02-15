/**
 * Helper: Runs a single task with retry logic and cancellation support.
 * @param {Function} taskFunction - The async task to run.
 * @param {number} howManyRetries - Number of retry attempts.
 * @param {AbortSignal} signal - Signal to monitor for cancellation.
 */
async function runTaskWithRetry(taskFunction, howManyRetries, signal) {
  let theError = null;

  for (let attempt = 0; attempt <= howManyRetries; attempt++) {
    // Check if user called cancelAll() before starting or retrying
    if (signal?.aborted) {
      throw new Error('Task cancelled');
    }

    try {
      const result = await taskFunction();
      return { status: 'success', value: result };
    } catch (err) {
      theError = err;
      
      // If we have retries left, wait before next attempt
      if (attempt < howManyRetries && !signal?.aborted) {
        const waitTime = 100 * (attempt + 1);
        await new Promise((resolve) => {
          const timer = setTimeout(resolve, waitTime);
          // Clean up timer if cancelled during the wait
          signal?.addEventListener('abort', () => clearTimeout(timer), { once: true });
        });
      }
    }
  }

  // Final failure after all retries
  const errorObj = theError instanceof Error ? theError : new Error(String(theError));
  return { status: 'captured', error: errorObj };
}

class AsyncQueue {
  constructor(maxAtSameTime, retryAttempts = 3) {
    if (maxAtSameTime < 1 || !Number.isInteger(maxAtSameTime)) {
      throw new Error('Concurrency must be a positive whole number');
    }

    this.maxAtSameTime = maxAtSameTime;
    this.retryAttempts = retryAttempts;
    this.abortController = null;
    
    // Internal State
    this.tasks = [];
    this.results = [];
    this.runningCount = 0;
    this.nextTaskIndex = 0;
    this.finishedCount = 0;
    this.resolveQueue = null;
  }

  /**
   * Main entry point to start the queue.
   * @param {Array<Function>} tasks - Array of functions returning Promises.
   */
  run(tasks) {
    if (!Array.isArray(tasks)) throw new Error('Tasks must be an array');
    
    // Reset state for a fresh run
    this.tasks = tasks;
    this.results = new Array(tasks.length).fill(null);
    this.abortController = new AbortController();
    this.nextTaskIndex = 0;
    this.runningCount = 0;
    this.finishedCount = 0;

    return new Promise((resolve) => {
      this.resolveQueue = resolve;

      if (this.tasks.length === 0) {
        return resolve([]);
      }

      // Fill up to the concurrency limit
      const initialBatch = Math.min(this.maxAtSameTime, this.tasks.length);
      for (let i = 0; i < initialBatch; i++) {
        this._processNext();
      }
    });
  }

  async _processNext() {
    // Stop if we've reached the end or if cancelled
    if (this.nextTaskIndex >= this.tasks.length || this.abortController.signal.aborted) {
      this._checkCompletion();
      return;
    }

    const currentIndex = this.nextTaskIndex++;
    const taskFn = this.tasks[currentIndex];
    this.runningCount++;

    try {
      // Execute the task using the retry helper
      const result = await runTaskWithRetry(
        taskFn, 
        this.retryAttempts, 
        this.abortController.signal
      );
      this.results[currentIndex] = result;
    } catch (err) {
      // This catch usually triggers if runTaskWithRetry throws (e.g., immediate cancellation)
      this.results[currentIndex] = { 
        status: 'captured', 
        error: err instanceof Error ? err : new Error(String(err)) 
      };
    } finally {
      this.runningCount--;
      this.finishedCount++;
      
      // Immediately pick up the next task
      this._processNext();
    }
  }

  _checkCompletion() {
    // Resolve only when all active workers have finished
    if (this.runningCount === 0) {
      // If cancelled, fill remaining null slots with cancellation errors
      if (this.abortController.signal.aborted) {
        const cancelErr = new Error('Task cancelled via cancelAll()');
        this.results = this.results.map(res => 
          res === null ? { status: 'captured', error: cancelErr } : res
        );
      }
      this.resolveQueue(this.results);
    }
  }

  cancelAll() {
    if (this.abortController) {
      this.abortController.abort();
    }
  }
}

module.exports = { AsyncQueue };