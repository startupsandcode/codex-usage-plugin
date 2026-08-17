const assert = require('node:assert/strict');
const vscode = require('vscode');
const extension = require('../src/extension');

const context = { subscriptions: [] };
extension.activate(context);

const timeout = setTimeout(() => {
  extension.deactivate();
  throw new Error(`Timed out waiting for usage: ${vscode.__statusItem.text}`);
}, 10_000);

const timer = setInterval(() => {
  if (!/%/.test(vscode.__statusItem.text)) return;
  clearTimeout(timeout);
  clearInterval(timer);
  assert.match(vscode.__statusItem.text, /^\$\(pulse\) Codex /);
  assert.match(vscode.__statusItem.tooltip, /% used/);
  process.stdout.write(`${vscode.__statusItem.text}\n${vscode.__statusItem.tooltip}\n`);
  extension.deactivate();
}, 50);
