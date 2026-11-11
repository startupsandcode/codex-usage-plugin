const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const vscode = require('vscode');

const { JsonLineRpc } = require('./rpc');
const { formatStatus, formatTooltip, selectRateLimit } = require('./usage');

let child;
let rpc;
let refreshTimer;
let reconnectTimer;
let statusItem;
let output;
let deactivating = false;

function bundledCodexPath() {
  const configured = vscode.workspace
    .getConfiguration('codexUsage')
    .get('codexExecutable', '')
    .trim();
  if (configured) return configured;

  const codexExtension = vscode.extensions.getExtension('openai.chatgpt');
  if (codexExtension) {
    const platforms = {
      darwin: 'macos',
      linux: 'linux',
      win32: 'windows',
    };
    const architectures = {
      arm64: 'aarch64',
      x64: 'x86_64',
    };
    const platform = platforms[process.platform];
    const architecture = architectures[process.arch];
    if (platform && architecture) {
      const executable = process.platform === 'win32' ? 'codex.exe' : 'codex';
      const candidate = path.join(
        codexExtension.extensionPath,
        'bin',
        `${platform}-${architecture}`,
        executable,
      );
      if (fs.existsSync(candidate)) return candidate;
    }
  }

  return 'codex';
}

function setUnavailable(detail) {
  statusItem.text = '$(warning) Codex usage unavailable';
  statusItem.tooltip = detail || 'Codex usage is unavailable';
}

async function refresh() {
  if (!rpc) return;
  try {
    const response = await rpc.request('account/rateLimits/read', null);
    const rateLimit = selectRateLimit(response);
    statusItem.text = `$(pulse) ${formatStatus(rateLimit)}`;
    statusItem.tooltip = formatTooltip(rateLimit);
  } catch (error) {
    output.appendLine(`Refresh failed: ${error.message}`);
    setUnavailable(error.message);
    // A hung app-server never exits on its own; kill it so the exit handler reconnects.
    if (error.code === 'RPC_TIMEOUT' && child && !child.killed) child.kill();
  }
}

function scheduleReconnect() {
  if (deactivating) return;
  clearTimeout(reconnectTimer);
  reconnectTimer = setTimeout(connect, 30_000);
}

async function connect() {
  if (deactivating) return;
  clearTimeout(reconnectTimer);
  clearInterval(refreshTimer);
  if (rpc) rpc.dispose();
  if (child && !child.killed) child.kill();

  const executable = bundledCodexPath();
  output.appendLine(`Starting ${executable} app-server`);
  const proc = spawn(executable, ['app-server', '--stdio'], {
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true,
  });
  child = proc;
  rpc = new JsonLineRpc(proc.stdout, proc.stdin);

  proc.stderr.setEncoding('utf8');
  proc.stderr.on('data', (chunk) => output.append(chunk));
  proc.on('error', (error) => {
    if (child !== proc) return;
    output.appendLine(`Codex app-server error: ${error.message}`);
    setUnavailable(error.message);
    scheduleReconnect();
  });
  proc.on('exit', (code, signal) => {
    // Ignore exits from a superseded process so they don't tear down the new connection.
    if (child !== proc) return;
    output.appendLine(`Codex app-server exited (${code ?? signal ?? 'unknown'})`);
    rpc?.dispose();
    rpc = undefined;
    setUnavailable('Codex app-server stopped. Reconnecting shortly.');
    scheduleReconnect();
  });
  rpc.onNotification((message) => {
    if (message.method === 'account/rateLimits/updated') void refresh();
  });

  // Arm polling before the first request so a stalled first call can't prevent retries.
  const seconds = vscode.workspace
    .getConfiguration('codexUsage')
    .get('refreshIntervalSeconds', 60);
  refreshTimer = setInterval(refresh, Math.max(15, seconds) * 1000);

  try {
    await rpc.request('initialize', {
      clientInfo: { name: 'codex-usage-status', version: '1.1.0' },
      capabilities: { experimentalApi: true },
    });
    rpc.notify('initialized');
    await refresh();
  } catch (error) {
    output.appendLine(`Initialization failed: ${error.message}`);
    setUnavailable(error.message);
    if (child && !child.killed) child.kill();
  }
}

function activate(context) {
  deactivating = false;
  output = vscode.window.createOutputChannel('Codex Usage');
  statusItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100,
  );
  statusItem.command = 'codexUsage.openCodex';
  statusItem.name = 'Codex Usage';
  statusItem.text = '$(sync~spin) Codex usage';
  statusItem.tooltip = 'Loading Codex usage';
  statusItem.show();

  context.subscriptions.push(
    output,
    statusItem,
    vscode.commands.registerCommand('codexUsage.refresh', refresh),
    vscode.commands.registerCommand('codexUsage.openCodex', async () => {
      await vscode.commands.executeCommand('chatgpt.openSidebar');
      await refresh();
    }),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration('codexUsage')) void connect();
    }),
  );

  void connect();
}

function deactivate() {
  deactivating = true;
  clearInterval(refreshTimer);
  clearTimeout(reconnectTimer);
  rpc?.dispose();
  if (child && !child.killed) child.kill();
}

module.exports = { activate, deactivate };
