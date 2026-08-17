# Codex Usage Plugin Design

## Goal

Publish a small, maintainable VS Code extension that shows the authenticated
Codex account's rate-limit usage in the status bar without reading prompts,
responses, tokens, or repository contents.

## User experience

The status bar displays every usage window returned for the canonical `codex`
rate-limit bucket, labeled by its actual duration, for example `Codex 7d 84%`
or `Codex 5h 32% · 7d 18%`. Hovering shows local reset times. Clicking opens
the official Codex sidebar and refreshes usage. The extension refreshes every
60 seconds and immediately after Codex emits a rate-limit update.

If Codex is unavailable or its protocol changes, the status item remains
visible with an unavailable state. Diagnostics go to a dedicated output
channel rather than disruptive notifications.

## Architecture

The extension starts the Codex CLI bundled with the official OpenAI VS Code
extension using `codex app-server --stdio`. It initializes the JSON-line RPC
connection with experimental API support, reads `account/rateLimits/read`, and
listens for `account/rateLimits/updated`. A configured executable path and the
shell `PATH` are fallbacks when the official extension's bundled CLI cannot be
found.

The code remains dependency-free at runtime:

- `src/extension.js` owns VS Code activation, process lifecycle, refreshes,
  reconnects, and status-bar rendering.
- `src/rpc.js` implements the minimal JSON-line request and notification client.
- `src/usage.js` selects and formats the canonical rate-limit snapshot.
- `test/` covers the protocol client and formatting behavior with Node's
  built-in test runner.

`@vscode/vsce` is a development dependency used only to produce a standard
VSIX package.

## Open-source project structure

The package keeps the extension name `codex-usage-status` and uses
`startupsandcode` as its publisher. The repository includes an MIT license,
README, contributing guide, changelog, security policy, Git ignore rules, and
GitHub Actions CI. CI runs tests and VSIX packaging on supported Node versions;
publishing to the VS Code Marketplace is deliberately excluded until a
publisher account and release policy exist.

The README documents installation from a release VSIX, development commands,
configuration, privacy behavior, and the experimental API compatibility risk.

## Security and privacy

The extension launches an exact executable without a shell. It sends only
Codex app-server protocol messages and does not directly make network calls.
It never reads or logs authentication tokens, prompts, responses, workspace
files, or repository data. App-server stderr is available in the output
channel for troubleshooting and may contain Codex diagnostics, so bug reports
should be reviewed before publication.

## Verification and release

Implementation follows a test-first flow. Completion requires the full unit
suite, JavaScript syntax checks, VSIX archive/package validation, and a live
activation smoke test against the locally installed Codex extension. The
repository build will replace the temporary locally installed extension to
avoid duplicate extension identities.

The initial implementation is committed to `main` and pushed to
`https://github.com/startupsandcode/codex-usage-plugin.git`. No Marketplace
publication is part of the initial release.
