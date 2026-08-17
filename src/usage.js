function formatDuration(minutes) {
  if (!Number.isFinite(minutes) || minutes <= 0) return 'usage';
  if (minutes % 1440 === 0) return `${minutes / 1440}d`;
  if (minutes % 60 === 0) return `${minutes / 60}h`;
  return `${minutes}m`;
}

function windows(rateLimit) {
  return [rateLimit?.primary, rateLimit?.secondary].filter(
    (window) => window && Number.isFinite(window.usedPercent),
  );
}

function formatStatus(rateLimit) {
  const parts = windows(rateLimit).map(
    (window) => `${formatDuration(window.windowDurationMins)} ${window.usedPercent}%`,
  );
  return parts.length ? `Codex ${parts.join(' · ')}` : 'Codex usage unavailable';
}

function formatTooltip(rateLimit, dateFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
})) {
  const lines = windows(rateLimit).map((window) => {
    const reset = Number.isFinite(window.resetsAt)
      ? `, resets ${dateFormatter.format(new Date(window.resetsAt * 1000))}`
      : '';
    return `${formatDuration(window.windowDurationMins)}: ${window.usedPercent}% used${reset}`;
  });
  return lines.length ? `Codex usage\n${lines.join('\n')}` : 'Codex usage is unavailable';
}

function selectRateLimit(response) {
  return response?.rateLimitsByLimitId?.codex ?? response?.rateLimits ?? {};
}

module.exports = {
  formatDuration,
  formatStatus,
  formatTooltip,
  selectRateLimit,
};
