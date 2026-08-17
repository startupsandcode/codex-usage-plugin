# Codex Usage Plugin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish and locally install a tested VS Code extension that shows Codex rate-limit usage and reset times in the status bar.

**Architecture:** A dependency-free runtime starts the Codex CLI bundled with the official OpenAI extension and talks JSON-line RPC over stdio. Pure formatting and RPC modules remain independently testable; the VS Code adapter owns lifecycle, status rendering, refresh, and reconnect behavior.

**Tech Stack:** CommonJS JavaScript, VS Code Extension API, Node.js built-in test runner, `@vscode/vsce`, GitHub Actions

**Spec:** `docs/superpowers/specs/2026-08-17-codex-usage-plugin-design.md`

## Global Constraints

- Extension package name is `codex-usage-status`; publisher is `startupsandcode`; initial version is `0.1.0`.
- Runtime code has no third-party dependencies.
- Use the official OpenAI extension's bundled Codex executable first, a configured executable second, and `codex` from `PATH` last.
- Do not read or log tokens, prompts, responses, workspace files, or repository content.
- Do not publish to the VS Code Marketplace.
- Work directly on `main`, as explicitly approved for this new repository.

---

### Task 1: Pure usage formatting and JSON-line RPC

**Files:**
- Create: `package.json`
- Create: `src/usage.js`
- Create: `src/rpc.js`
- Create: `test/usage.test.js`
- Create: `test/rpc.test.js`

**Interfaces:**
- Produces: `formatDuration(minutes)`, `formatStatus(rateLimit)`, `formatTooltip(rateLimit, formatter)`, and `selectRateLimit(response)` from `src/usage.js`.
- Produces: `JsonLineRpc` with `request(method, params)`, `notify(method, params)`, `onNotification(listener)`, and `dispose()` from `src/rpc.js`.

- [ ] **Step 1: Add the package test command and failing usage tests**

```json
{
  "scripts": { "test": "node --test test/*.test.js" }
}
```

Tests assert that 300 minutes formats as `5h`, 10080 as `7d`, two windows render as `Codex 7d 84% · 5h 21%`, the canonical `codex` bucket wins, reset times appear in tooltips, and missing windows render an unavailable state.

- [ ] **Step 2: Run the usage test and verify RED**

Run: `node --test test/usage.test.js`
Expected: FAIL because `src/usage.js` does not exist.

- [ ] **Step 3: Implement the pure usage formatter**

```js
function selectRateLimit(response) {
  return response?.rateLimitsByLimitId?.codex ?? response?.rateLimits ?? {};
}
```

Render only finite `usedPercent` values. Derive labels from `windowDurationMins`; never hardcode a five-hour window.

- [ ] **Step 4: Run the usage tests and verify GREEN**

Run: `node --test test/usage.test.js`
Expected: 5 tests pass with 0 failures.

- [ ] **Step 5: Add failing JSON-line RPC tests**

Use `PassThrough` streams to assert request serialization, matching response resolution, notification delivery, and server-error rejection.

- [ ] **Step 6: Run the RPC test and verify RED**

Run: `node --test test/rpc.test.js`
Expected: FAIL because `src/rpc.js` does not exist.

- [ ] **Step 7: Implement the JSON-line RPC client**

```js
class JsonLineRpc {
  request(method, params) {}
  notify(method, params) {}
  onNotification(listener) {}
  dispose() {}
}
```

Allocate numeric request IDs, buffer partial lines, ignore malformed lines, resolve or reject matching requests, and reject pending requests on disposal.

- [ ] **Step 8: Verify and commit the pure modules**

Run: `npm test`
Expected: 8 tests pass with 0 failures.

```bash
git add package.json src/usage.js src/rpc.js test/usage.test.js test/rpc.test.js
git commit -m "feat: add codex usage protocol and formatting"
```

### Task 2: VS Code extension lifecycle and live smoke test

**Files:**
- Create: `src/extension.js`
- Create: `test/fixtures/vscode/index.js`
- Create: `test/smoke.js`
- Modify: `package.json`

**Interfaces:**
- Consumes: `JsonLineRpc`, `formatStatus`, `formatTooltip`, and `selectRateLimit` from Task 1.
- Produces: VS Code `activate(context)` and `deactivate()` entry points.

- [ ] **Step 1: Add a smoke harness with a minimal VS Code API fixture**

The fixture records status text and tooltip, points `openai.chatgpt` at the installed official extension, and supplies command, configuration, output-channel, and subscription stubs. The smoke script activates the extension and fails after 10 seconds unless both status text and tooltip contain a percentage.

- [ ] **Step 2: Run the smoke harness and verify RED**

Run: `NODE_PATH=test/fixtures node test/smoke.js`
Expected: FAIL because `src/extension.js` does not exist.

- [ ] **Step 3: Implement extension activation and process lifecycle**

```js
const child = spawn(executable, ['app-server', '--stdio'], {
  stdio: ['pipe', 'pipe', 'pipe'],
  windowsHide: true,
});
```

Initialize with `experimentalApi: true`, request `account/rateLimits/read`, refresh on `account/rateLimits/updated`, poll every 60 seconds, reconnect after 30 seconds, and expose `codexUsage.refresh` plus `codexUsage.openCodex`. Clicking runs `chatgpt.openSidebar` and refreshes.

- [ ] **Step 4: Run syntax, unit, and live activation verification**

Run: `node --check src/extension.js && npm test`
Expected: syntax succeeds and 8 tests pass.

Run: `NODE_PATH=test/fixtures node test/smoke.js`
Expected: status text such as `$(pulse) Codex 7d 84%` and a tooltip containing `% used`.

- [ ] **Step 5: Commit the VS Code integration**

```bash
git add package.json src/extension.js test/fixtures/vscode/index.js test/smoke.js
git commit -m "feat: show codex usage in the status bar"
```

### Task 3: Open-source packaging, CI, installation, and publication

**Files:**
- Create: `.gitignore`
- Create: `.github/workflows/ci.yml`
- Create: `.github/CONTRIBUTING.md`
- Create: `.github/SECURITY.md`
- Create: `LICENSE`
- Create: `CHANGELOG.md`
- Create: `README.md`
- Create: `package-lock.json`
- Modify: `package.json`

**Interfaces:**
- Consumes: the extension implementation and tests from Tasks 1 and 2.
- Produces: `npm test`, `npm run check`, and `npm run package` contributor workflows plus a standard `.vsix` artifact.

- [ ] **Step 1: Complete the extension manifest and package scripts**

Set `main` to `./src/extension.js`, VS Code engine to `^1.90.0`, startup and command activation events, command contributions, and configuration for `refreshIntervalSeconds` plus `codexExecutable`. Add `@vscode/vsce` as a development dependency and these scripts:

```json
{
  "check": "node --check src/extension.js && node --check src/rpc.js && node --check src/usage.js && npm test",
  "package": "vsce package --out dist/codex-usage-status.vsix"
}
```

- [ ] **Step 2: Install the development dependency and lock it**

Run: `npm install`
Expected: `package-lock.json` is created and the audit reports no unresolved critical runtime issue.

- [ ] **Step 3: Add MIT and contributor-facing documentation**

README sections: what it shows, screenshot placeholder omitted, requirements, release-VSIX installation, local development, settings, privacy, experimental API caveat, and uninstall command. Contributing requires tests and no secrets in diagnostics. Security policy requests private vulnerability reports through GitHub Security Advisories. Changelog records version `0.1.0`.

- [ ] **Step 4: Add CI and ignore generated artifacts**

CI checks out code, installs Node 22, runs `npm ci`, `npm run check`, and `npm run package`. Ignore `node_modules/`, `dist/`, `*.vsix`, and editor/OS artifacts.

- [ ] **Step 5: Verify the repository and build the VSIX**

Run: `npm run check`
Expected: 8 tests pass and all syntax checks succeed.

Run: `npm run package`
Expected: `dist/codex-usage-status.vsix` is created by VSCE without package errors.

- [ ] **Step 6: Replace the temporary local extension and smoke test the repository build**

```bash
code --uninstall-extension local.codex-usage-status
code --install-extension dist/codex-usage-status.vsix --force
code --list-extensions --show-versions
```

Expected: `startupsandcode.codex-usage-status@0.1.0` is installed and `local.codex-usage-status` is absent. Run the live smoke test once more and reload VS Code if needed.

- [ ] **Step 7: Commit, verify refs, and publish only this repository**

```bash
git add .gitignore .github LICENSE CHANGELOG.md README.md package.json package-lock.json
git commit -m "docs: prepare initial open source release"
git status --short
git push -u origin main
git fetch origin main
git rev-list --left-right --count main...origin/main
```

Expected: clean status and `0 0` divergence after the push and fetch.
