/**
 * AsyncQueue - Test Suite
 *
 * Run with: node test.js
 */

const { AsyncQueue } = require('./AsyncQueue');

function delay(ms, value) {
  return new Promise((r) => setTimeout(() => r(value), ms));
}

let passed = 0;
let failed = 0;

function assert(condition, msg) {
  if (condition) {
    passed++;
    console.log('  ✓', msg);
  } else {
    failed++;
    console.log('  ✗', msg);
  }
}

function assertDeepEqual(a, b, msg) {
  const ok = JSON.stringify(a) === JSON.stringify(b);
  assert(ok, msg || `Expected ${JSON.stringify(a)} === ${JSON.stringify(b)}`);
}

async function runTests() {
  console.log('\n=== AsyncQueue Test Suite ===\n');

  // Test 1: Concurrency limit
  console.log('Test 1: Concurrency limit (max 2 simultaneous)');
  {
    let concurrent = 0;
    let maxConcurrent = 0;
    const queue = new AsyncQueue(2);
    const tasks = [0, 1, 2, 3].map((i) => async () => {
      concurrent++;
      maxConcurrent = Math.max(maxConcurrent, concurrent);
      await delay(50);
      concurrent--;
      return i;
    });
    const results = await queue.run(tasks);
    assert(maxConcurrent <= 2, `Max concurrent was ${maxConcurrent}, expected ≤ 2`);
    assert(results.length === 4, 'Result count');
    assert(results.every((r) => r.status === 'success'), 'All succeeded');
  }

  // Test 2: Order preservation
  console.log('\nTest 2: Order preservation');
  {
    const queue = new AsyncQueue(5);
    const tasks = [
      () => delay(100, 'a'),
      () => delay(10, 'b'),
      () => delay(50, 'c'),
      () => delay(20, 'd'),
    ];
    const results = await queue.run(tasks);
    const values = results.map((r) => (r.status === 'success' ? r.value : null));
    assertDeepEqual(values, ['a', 'b', 'c', 'd'], 'Order matches input');
  }

  // Test 3: Retry on failure
  console.log('\nTest 3: Retry on failure');
  {
    let attempts = 0;
    const queue = new AsyncQueue(1, 3);
    const tasks = [
      () => {
        attempts++;
        if (attempts < 3) throw new Error('fail');
        return Promise.resolve('ok');
      },
    ];
    const results = await queue.run(tasks);
    assert(results[0].status === 'success', 'Task eventually succeeded');
    assert(results[0].value === 'ok', 'Correct value');
    assert(attempts === 3, `Attempts was ${attempts}, expected 3`);
  }

  // Test 4: Error capture after retries
  console.log('\nTest 4: Error capture after all retries');
  {
    const queue = new AsyncQueue(1, 3);
    const tasks = [() => Promise.reject(new Error('permanent'))];
    const results = await queue.run(tasks);
    assert(results[0].status === 'captured', 'Status is captured');
    assert(results[0].error?.message === 'permanent', 'Error message preserved');
  }

  // Test 5: Empty array
  console.log('\nTest 5: Empty tasks array');
  {
    const queue = new AsyncQueue(2);
    const results = await queue.run([]);
    assertDeepEqual(results, [], 'Empty result');
  }

  // Test 6: cancelAll
  console.log('\nTest 6: cancelAll()');
  {
    const queue = new AsyncQueue(1, 3);
    const tasks = [
      () => delay(30).then(() => 'a'),
      () => delay(30).then(() => 'b'),
      () => delay(30).then(() => 'c'),
    ];
    const p = queue.run(tasks);
    await delay(35);
    queue.cancelAll();
    const results = await p;
    const successCount = results.filter((r) => r.status === 'success').length;
    const cancelledCount = results.filter((r) => r.error?.message?.includes('cancelAll')).length;
    assert(successCount >= 1, 'At least one completed');
    assert(cancelledCount >= 1, 'At least one cancelled');
  }

  // Test 7: Mixed results
  console.log('\nTest 7: Mixed success and failure');
  {
    const queue = new AsyncQueue(2, 2);
    const tasks = [
      () => Promise.resolve(1),
      () => Promise.reject(new Error('e2')),
      () => Promise.resolve(3),
    ];
    const results = await queue.run(tasks);
    assert(results[0].status === 'success' && results[0].value === 1, 'Task 0 ok');
    assert(results[1].status === 'captured' && results[1].error?.message === 'e2', 'Task 1 captured');
    assert(results[2].status === 'success' && results[2].value === 3, 'Task 2 ok');
  }

  // Test 8: Invalid concurrency
  console.log('\nTest 8: Invalid concurrency throws');
  {
    let threw = false;
    try {
      new AsyncQueue(0);
    } catch (e) {
      threw = true;
    }
    assert(threw, 'Throws for concurrency 0');
  }

  console.log('\n--- Summary ---');
  console.log(`Passed: ${passed}, Failed: ${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch((e) => {
  console.error(e);
  process.exit(1);
});
