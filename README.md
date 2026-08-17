# Codex Usage Status

A small VS Code extension that shows your Codex rate-limit usage in the status
bar.

`Codex 5h 32% · 7d 18%`

Hover over the status item to see reset times. Click it to open the official
Codex sidebar and refresh the values.

## Requirements

- VS Code 1.90 or newer
- The official OpenAI Codex VS Code extension
- An authenticated Codex session

## Install from a VSIX

Download `codex-usage-status.vsix` from a GitHub release, then run:

```bash
code --install-extension codex-usage-status.vsix
```

Until a release is available, build it locally:

```bash
git clone https://github.com/startupsandcode/codex-usage-plugin.git
cd codex-usage-plugin
npm ci
npm run package
code --install-extension dist/codex-usage-status.vsix
```

Reload the VS Code window if the status item does not appear immediately.

## How it works

The extension starts the Codex CLI bundled with the official OpenAI extension
and reads `account/rateLimits/read` through the local Codex app-server protocol.
It labels each window using the duration Codex actually reports instead of
assuming every account has the same limits.

Usage refreshes every 60 seconds and when Codex emits a rate-limit update.

## Settings

- `codexUsage.refreshIntervalSeconds`: fallback refresh interval, minimum 15
  seconds and default 60 seconds.
- `codexUsage.codexExecutable`: optional path to a Codex CLI executable. The
  official extension's bundled CLI is used by default.

Commands are available from the Command Palette:

- `Codex Usage: Refresh`
- `Codex Usage: Open Codex`

## Privacy

This extension does not read or log prompts, responses, authentication tokens,
workspace files, or repository content. It does not make network requests
directly. The Codex app server may use the authenticated Codex session to fetch
current rate limits.

Diagnostics from the app server appear in the **Codex Usage** output channel.
Review that output before including it in a public bug report.

## Compatibility

The Codex app-server API is experimental and may change in a future Codex
release. If the status item reports that usage is unavailable, check the Codex
Usage output channel and open an issue with the Codex and extension versions.

## Development

```bash
npm ci
npm run check
npm run package
```

The runtime has no third-party dependencies. `@vscode/vsce` is used only to
package the extension.

## Uninstall

```bash
code --uninstall-extension startupsandcode.codex-usage-status
```

## License

[MIT](LICENSE)

Codex and OpenAI are trademarks of OpenAI. This is an independent community
project and is not an official OpenAI product.
