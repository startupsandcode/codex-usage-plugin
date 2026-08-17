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
