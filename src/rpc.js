const { EventEmitter } = require('node:events');

class JsonLineRpc {
  constructor(readable, writable) {
    this.readable = readable;
    this.writable = writable;
    this.nextId = 1;
    this.pending = new Map();
    this.notifications = new EventEmitter();
    this.buffer = '';
    this.onData = this.onData.bind(this);
    this.readable.setEncoding('utf8');
    this.readable.on('data', this.onData);
  }

  request(method, params) {
    const id = this.nextId++;
    const promise = new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
    });
    this.writable.write(`${JSON.stringify({ id, method, params })}\n`);
    return promise;
  }

  notify(method, params) {
    const message = params === undefined ? { method } : { method, params };
    this.writable.write(`${JSON.stringify(message)}\n`);
  }

  onNotification(listener) {
    this.notifications.on('notification', listener);
    return () => this.notifications.off('notification', listener);
  }

  onData(chunk) {
    this.buffer += chunk;
    for (;;) {
      const newline = this.buffer.indexOf('\n');
      if (newline < 0) return;
      const line = this.buffer.slice(0, newline).trim();
      this.buffer = this.buffer.slice(newline + 1);
      if (!line) continue;
      let message;
      try {
        message = JSON.parse(line);
      } catch {
        continue;
      }
      if (message.id !== undefined && this.pending.has(message.id)) {
        const pending = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) {
          pending.reject(new Error(message.error.message || 'Codex app-server request failed'));
        } else {
          pending.resolve(message.result);
        }
      } else if (message.method) {
        this.notifications.emit('notification', message);
      }
    }
  }

  dispose() {
    this.readable.off('data', this.onData);
    for (const { reject } of this.pending.values()) {
      reject(new Error('Codex app-server connection closed'));
    }
    this.pending.clear();
    this.notifications.removeAllListeners();
  }
}

module.exports = { JsonLineRpc };
