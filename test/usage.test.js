const test = require('node:test');
const assert = require('node:assert/strict');

const {
  formatDuration,
  formatStatus,
  formatTooltip,
  selectRateLimit,
} = require('../src/usage');

test('formats common rate-limit window durations', () => {
  assert.equal(formatDuration(300), '5h');
  assert.equal(formatDuration(10080), '7d');
  assert.equal(formatDuration(null), 'usage');
});

test('shows each available usage window in the status bar', () => {
  assert.equal(
    formatStatus({
      primary: { usedPercent: 84, windowDurationMins: 10080 },
      secondary: { usedPercent: 21, windowDurationMins: 300 },
    }),
    'Codex 7d 84% · 5h 21%',
  );
});

test('uses the canonical codex bucket when multi-bucket data is present', () => {
  const selected = selectRateLimit({
    rateLimits: { primary: { usedPercent: 99 } },
    rateLimitsByLimitId: {
      codex_bengalfox: { primary: { usedPercent: 2 } },
      codex: { primary: { usedPercent: 84 } },
    },
  });

  assert.equal(selected.primary.usedPercent, 84);
});

test('tooltip includes local reset times', () => {
  const tooltip = formatTooltip(
    {
      primary: {
        usedPercent: 84,
        windowDurationMins: 10080,
        resetsAt: 1_800_000_000,
      },
    },
    new Intl.DateTimeFormat('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'UTC',
    }),
  );

  assert.match(tooltip, /^Codex usage$/m);
  assert.match(tooltip, /7d: 84% used/);
  assert.match(tooltip, /resets/);
});

test('returns an unavailable state when no windows are reported', () => {
  assert.equal(formatStatus({}), 'Codex usage unavailable');
});
