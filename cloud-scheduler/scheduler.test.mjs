import test from 'node:test';
import assert from 'node:assert/strict';
import worker, {dispatchUpdate} from './worker.mjs';

test('dispatch retries a transient error and sends the expected branch', async () => {
  const calls = [], delays = [];
  const result = await dispatchUpdate({GITHUB_DISPATCH_TOKEN: 'test-only'}, {
    request: async (url, options) => {
      calls.push({url, options});
      return new Response(null, {status: calls.length === 1 ? 503 : 204});
    },
    sleep: async ms => delays.push(ms),
  });
  assert.deepEqual(result, {accepted: true, attempts: 2});
  assert.deepEqual(delays, [5000]);
  assert.deepEqual(JSON.parse(calls[1].options.body), {ref: 'main'});
  assert.equal(calls[1].options.method, 'POST');
});

test('invalid credentials fail without retries or exposing secret', async () => {
  let calls = 0;
  await assert.rejects(dispatchUpdate({GITHUB_DISPATCH_TOKEN: 'private-test-value'}, {
    request: async () => {calls++; return new Response(null, {status: 401});},
  }), {message: 'GitHub rejected dispatch (HTTP 401)'});
  assert.equal(calls, 1);
});

test('network failure is bounded to three attempts', async () => {
  let calls = 0;
  await assert.rejects(dispatchUpdate({GITHUB_DISPATCH_TOKEN: 'test-only'}, {
    request: async () => {calls++; throw new Error('private detail');}, sleep: async () => {},
  }), {message: 'GitHub dispatch network request failed after 3 attempts'});
  assert.equal(calls, 3);
});

test('missing secret cannot dispatch and public requests cannot trigger', async () => {
  await assert.rejects(dispatchUpdate({}), /Missing GITHUB_DISPATCH_TOKEN/);
  assert.equal(worker.fetch().status, 404);
});
