/**
 * AsyncQueue - Usage Examples
 *
 * This file demonstrates all features of the AsyncQueue:
 * 1. Concurrency control
 * 2. Ordered results (Promise.all behavior)
 * 3. Retry on failure
 * 4. Error capture after retries
 * 5. cancelAll() for cancellation
 */

const { AsyncQueue } = require('./AsyncQueue');

// --- Example 1: Basic usage with concurrency limit ---
async function example1_BasicConcurrency() {
  console.log('\n=== Example 1: Basic Concurrency (limit: 2) ===\n');

  const queue = new AsyncQueue(2);

  const tasks = [
    () => delay(100).then(() => 'Task 1'),
    () => delay(150).then(() => 'Task 2'),
    () => delay(50).then(() => 'Task 3'),
    () => delay(80).then(() => 'Task 4'),
  ];

  const results = await queue.run(tasks);

  results.forEach((r, i) => {
    console.log(`  Task ${i + 1}:`, r.status === 'success' ? r.value : r.error.message);
  });
  console.log('\n  Results order matches input order:', results.map((r) => r.status === 'success' ? r.value : 'ERR'));
}

// --- Example 2: Retry on failure ---
async function example2_Retry() {
  console.log('\n=== Example 2: Retry on Failure ===\n');

  const queue = new AsyncQueue(1, 3); // concurrency 1, 3 retries

  let attemptCount = 0;
  const tasks = [
    () => {
      attemptCount++;
      console.log(`  Attempt ${attemptCount}...`);
      if (attemptCount < 3) {
        return Promise.reject(new Error('Temporary failure'));
      }
      return Promise.resolve('Succeeded on attempt 3!');
    },
  ];

  const results = await queue.run(tasks);
  console.log('  Result:', results[0].status === 'success' ? results[0].value : results[0].error.message);
}

// --- Example 3: Error capture after all retries ---
async function example3_ErrorCapture() {
  console.log('\n=== Example 3: Error Capture (fails after 3 retries) ===\n');

  const queue = new AsyncQueue(1, 3);

  const tasks = [
    () => Promise.reject(new Error('Always fails')),
  ];

  const results = await queue.run(tasks);
  const r = results[0];
  console.log('  Status:', r.status);
  console.log('  Captured error:', r.error?.message);
}

// --- Example 4: Mixed success and failure ---
async function example4_MixedResults() {
  console.log('\n=== Example 4: Mixed Success and Failure ===\n');

  const queue = new AsyncQueue(2, 2);

  const tasks = [
    () => Promise.resolve('OK-1'),
    () => Promise.reject(new Error('Fail-2')),
    () => Promise.resolve('OK-3'),
    () => Promise.resolve('OK-4'),
  ];

  const results = await queue.run(tasks);

  results.forEach((r, i) => {
    const msg = r.status === 'success' ? `✓ ${r.value}` : `✗ ${r.error.message}`;
    console.log(`  [${i}]: ${msg}`);
  });
}

// --- Example 5: cancelAll() ---
async function example5_CancelAll() {
  console.log('\n=== Example 5: cancelAll() ===\n');

  const queue = new AsyncQueue(2, 3);

  const tasks = [
    () => delay(50).then(() => 'Done 1'),
    () => delay(200).then(() => 'Done 2'),
    () => delay(100).then(() => 'Done 3'),
    () => delay(100).then(() => 'Done 4'),
    () => delay(100).then(() => 'Done 5'),
  ];

  const promise = queue.run(tasks);

  await delay(120);
  console.log('  Calling cancelAll() after 120ms...');
  queue.cancelAll();

  const results = await promise;
  const completed = results.filter((r) => r.status === 'success').length;
  const cancelled = results.filter((r) => r.error?.message?.includes('cancelAll')).length;

  console.log(`  Completed: ${completed}, Cancelled: ${cancelled}`);
  results.forEach((r, i) => {
    const msg = r.status === 'success' ? r.value : r.error?.message;
    console.log(`  [${i}]: ${msg}`);
  });
}

// --- Example 6: Order preservation (like Promise.all) ---
async function example6_OrderPreservation() {
  console.log('\n=== Example 6: Order Preservation ===\n');

  const queue = new AsyncQueue(5); // High concurrency - tasks finish out of order

  const tasks = [
    () => delay(200).then(() => 'first'),
    () => delay(50).then(() => 'second'),
    () => delay(100).then(() => 'third'),
    () => delay(30).then(() => 'fourth'),
    () => delay(150).then(() => 'fifth'),
  ];

  const results = await queue.run(tasks);
  const values = results.map((r) => (r.status === 'success' ? r.value : r.error?.message));
  console.log('  Output order:', values);
  console.log('  Expected:    [first, second, third, fourth, fifth]');
}

// --- Helper ---
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// --- Run all examples ---
async function main() {
  console.log('\n╔════════════════════════════════════════════╗');
  console.log('║     AsyncQueue - Usage Examples           ║');
  console.log('╚════════════════════════════════════════════╝');

  await example1_BasicConcurrency();
  await example2_Retry();
  await example3_ErrorCapture();
  await example4_MixedResults();
  await example5_CancelAll();
  await example6_OrderPreservation();

  console.log('\n✓ All examples completed.\n');
}

main().catch(console.error);
