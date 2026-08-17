const statusItem = {
  text: '',
  tooltip: '',
  show() {},
  dispose() {},
};

module.exports = {
  __statusItem: statusItem,
  StatusBarAlignment: { Right: 2 },
  extensions: {
    getExtension(id) {
      if (id !== 'openai.chatgpt' || !process.env.CODEX_EXTENSION_PATH) {
        return undefined;
      }
      return { extensionPath: process.env.CODEX_EXTENSION_PATH };
    },
  },
  workspace: {
    getConfiguration() {
      return {
        get(key, fallback) {
          if (key === 'codexExecutable' && process.env.CODEX_EXECUTABLE) {
            return process.env.CODEX_EXECUTABLE;
          }
          return fallback;
        },
      };
    },
    onDidChangeConfiguration() { return { dispose() {} }; },
  },
  window: {
    createOutputChannel() {
      return { append() {}, appendLine() {}, dispose() {} };
    },
    createStatusBarItem() { return statusItem; },
  },
  commands: {
    registerCommand() { return { dispose() {} }; },
    async executeCommand() {},
  },
};
