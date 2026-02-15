# AsyncQueue — Asynchronous Task Queue with Concurrency Limit

A JavaScript class for managing a queue of asynchronous tasks with strict concurrency control, automatic retries, error capture, and cancellation support.

---

## Requirements Coverage

| Requirement | Status |
|-------------|--------|
| **1. Concurrency Control** | ✓ Accepts array of Promise-returning functions; `concurrency` limits simultaneous tasks |
| **2. Execution Results** | ✓ Returns single array; order matches input (like `Promise.all`) |
| **3. Error Handling & Retry** | ✓ 3 automatic retries on failure; failed tasks marked as "captured" |
| **4. Status Management** | ✓ `cancelAll()` cancels remaining queued tasks |

---

## Installation

No dependencies. Plain Node.js (v14+).

```bash
node AsyncQueue.js
```

---

## Quick Start

```javascript
const { AsyncQueue } = require('./AsyncQueue');

const queue = new AsyncQueue(2); // max 2 tasks at a time

const tasks = [
  () => fetch('/api/1').then(r => r.json()),
  () => fetch('/api/2').then(r => r.json()),
  () => fetch('/api/3').then(r => r.json()),
];

const results = await queue.run(tasks);
// results[i] is { status: 'success', value } or { status: 'captured', error }
```

---

## API

### `new AsyncQueue(concurrency, retryAttempts?)`

- **concurrency** (number): Maximum number of tasks running at once. Must be ≥ 1.
- **retryAttempts** (number, default: 3): Retries per task on failure.

### `queue.run(tasks)`

- **tasks** (Array): Array of functions that return Promises.
- **Returns**: `Promise<Array<QueueResult>>` — results in the same order as `tasks`.

### `queue.cancelAll()`

Cancels all tasks that have not yet started. Tasks already running will finish.

---

## Result Format

Each element of the result array is one of:

**Success:**
```javascript
{ status: 'success', value: <resolved value> }
```

**Failure (after retries):**
```javascript
{ status: 'captured', error: <Error object> }
```

---

## Concurrency Control

The queue enforces the concurrency limit strictly. With `concurrency = 2`:

- At most 2 tasks run at the same time.
- When one finishes, the next queued task starts.
- No more than 2 tasks are ever in flight.

---

## Retry Logic

1. A task throws or rejects → retry.
2. Up to `retryAttempts` retries (default 3).
3. Exponential backoff between retries (100ms, 200ms, 300ms).
4. If all attempts fail → result is `{ status: 'captured', error }`.

---

## Order Preservation

Results are returned in the same order as the input tasks, regardless of completion order:

```javascript
// Task 2 may finish before Task 1, but:
// results[0] = task1 result, results[1] = task2 result
```

---

## Cancellation

`cancelAll()`:

- Aborts the internal controller.
- Prevents new tasks from starting.
- Tasks already running complete normally.
- Queued tasks that never started get `{ status: 'captured', error }` with a "Task cancelled via cancelAll()" message.

---

## Files

| File | Description |
|------|-------------|
| `AsyncQueue.js` | Main implementation |
| `example.js` | Usage examples |
| `test.js` | Test suite |
| `README.md` | This documentation |

---

## Run Examples & Tests

```bash
node example.js
node test.js
```

---

## Design Notes

- **No memory leaks**: Uses `AbortController` for cancellation; no dangling listeners.
- **No zombie processes**: All promises resolve or reject; no orphaned work.
- **Readable code**: Clear structure, JSDoc, and explicit error handling.
# async
