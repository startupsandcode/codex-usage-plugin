const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { chmodSync, mkdtempSync, rmSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');

test('deactivation exits without scheduling a reconnect', async () => {
  const projectRoot = path.resolve(__dirname, '..');
  const tempDirectory = mkdtempSync(path.join(tmpdir(), 'codex-usage-test-'));
  const fakeCodex = path.join(tempDirectory, 'codex');
  writeFileSync(fakeCodex, `#!/usr/bin/env node
let buffer = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  buffer += chunk;
  for (;;) {
    const newline = buffer.indexOf('\\n');
    if (newline < 0) break;
    const line = buffer.slice(0, newline);
    buffer = buffer.slice(newline + 1);
    if (!line.trim()) continue;
    const message = JSON.parse(line);
    if (message.method === 'initialize') {
      process.stdout.write(JSON.stringify({ id: message.id, result: {} }) + '\\n');
    }
    if (message.method === 'account/rateLimits/read') {
      process.stdout.write(JSON.stringify({
        id: message.id,
        result: {
          rateLimits: {
            primary: { usedPercent: 42, windowDurationMins: 300 },
          },
        },
      }) + '\\n');
    }
  }
});
`);
  chmodSync(fakeCodex, 0o755);

  let stdout = '';
  let stderr = '';
  const child = spawn(process.execPath, ['test/smoke.js'], {
    cwd: projectRoot,
    env: {
      ...process.env,
      CODEX_EXECUTABLE: fakeCodex,
      NODE_PATH: path.join(projectRoot, 'test', 'fixtures'),
    },
  });
  child.stdout.on('data', (chunk) => { stdout += chunk; });
  child.stderr.on('data', (chunk) => { stderr += chunk; });

  try {
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        child.kill();
        reject(new Error(`Smoke process did not exit after deactivation:\n${stdout}${stderr}`));
      }, 2_000);
      child.on('exit', (code) => {
        clearTimeout(timeout);
        if (code === 0) resolve();
        else reject(new Error(`Smoke process exited ${code}:\n${stdout}${stderr}`));
      });
    });
    assert.match(stdout, /Codex 5h 42%/);
  } finally {
    rmSync(tempDirectory, { recursive: true, force: true });
  }
});
