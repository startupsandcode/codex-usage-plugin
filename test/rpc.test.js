const test = require('node:test');
const assert = require('node:assert/strict');
const { PassThrough } = require('node:stream');

const { JsonLineRpc } = require('../src/rpc');

test('sends JSON-line requests and resolves matching responses', async () => {
  const input = new PassThrough();
  const output = new PassThrough();
  const rpc = new JsonLineRpc(input, output);
  let written = '';
  output.on('data', (chunk) => { written += chunk; });

  const response = rpc.request('account/rateLimits/read', null);
  await new Promise((resolve) => setImmediate(resolve));

  const request = JSON.parse(written.trim());
  assert.equal(request.method, 'account/rateLimits/read');
  input.write(`${JSON.stringify({ id: request.id, result: { ok: true } })}\n`);

  assert.deepEqual(await response, { ok: true });
  rpc.dispose();
});

test('emits notifications independently of responses', async () => {
  const input = new PassThrough();
  const output = new PassThrough();
  const rpc = new JsonLineRpc(input, output);
  const received = new Promise((resolve) => rpc.onNotification(resolve));

  input.write(`${JSON.stringify({ method: 'account/rateLimits/updated', params: {} })}\n`);

  assert.equal((await received).method, 'account/rateLimits/updated');
  rpc.dispose();
});

test('rejects a request when the server returns an error', async () => {
  const input = new PassThrough();
  const output = new PassThrough();
  const rpc = new JsonLineRpc(input, output);
  let written = '';
  output.on('data', (chunk) => { written += chunk; });

  const response = rpc.request('initialize', {});
  await new Promise((resolve) => setImmediate(resolve));
  const request = JSON.parse(written.trim());
  input.write(`${JSON.stringify({ id: request.id, error: { message: 'nope' } })}\n`);

  await assert.rejects(response, /nope/);
  rpc.dispose();
});

test('rejects with RPC_TIMEOUT when the server never responds', async () => {
  const input = new PassThrough();
  const output = new PassThrough();
  const rpc = new JsonLineRpc(input, output, { timeoutMs: 20 });

  await assert.rejects(rpc.request('account/rateLimits/read', null), (error) => {
    assert.equal(error.code, 'RPC_TIMEOUT');
    assert.match(error.message, /account\/rateLimits\/read/);
    return true;
  });
  assert.equal(rpc.pending.size, 0);
  rpc.dispose();
});

test('a late response after a timeout is ignored', async () => {
  const input = new PassThrough();
  const output = new PassThrough();
  const rpc = new JsonLineRpc(input, output, { timeoutMs: 20 });
  let written = '';
  output.on('data', (chunk) => { written += chunk; });

  const response = rpc.request('initialize', {});
  await assert.rejects(response, { code: 'RPC_TIMEOUT' });
  input.write(`${JSON.stringify({ id: JSON.parse(written.trim()).id, result: {} })}\n`);
  await new Promise((resolve) => setImmediate(resolve));
  rpc.dispose();
});

test('a timely response clears the timeout timer', async () => {
  const input = new PassThrough();
  const output = new PassThrough();
  const rpc = new JsonLineRpc(input, output, { timeoutMs: 30 });
  let written = '';
  output.on('data', (chunk) => { written += chunk; });

  const response = rpc.request('initialize', {});
  await new Promise((resolve) => setImmediate(resolve));
  input.write(`${JSON.stringify({ id: JSON.parse(written.trim()).id, result: { ok: 1 } })}\n`);
  assert.deepEqual(await response, { ok: 1 });
  await new Promise((resolve) => setTimeout(resolve, 60));
  rpc.dispose();
});
