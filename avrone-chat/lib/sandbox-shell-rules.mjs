/** Shared allow/deny rules (JS) — imported by tests and kept in sync with sandbox-shell.ts */
export const ALLOWED_COMMANDS = new Set([
  'ls', 'pwd', 'echo', 'date', 'uname', 'wc', 'head', 'tail', 'cat', 'printf',
  'true', 'false', 'basename', 'dirname', 'whoami', 'id', 'env', 'printenv',
  'node', 'which', 'test', 'stat', 'find', 'grep', 'rg', 'sort', 'uniq', 'cut',
  'tr', 'sed', 'awk'
]);

export const DENY_PATTERNS = [
  /\brm\s+(-[a-zA-Z]*f[a-zA-Z]*\s+)?\/\b/,
  /\brm\s+-rf\b/,
  /\bsudo\b/,
  /\bchmod\s+777\b/,
  /\bchown\b/,
  /\bmkfs\b/,
  /\bdd\s+if=/,
  /\bcurl\b.*(?:169\.254\.169\.254|metadata\.google|metadata\.azure|instance-data)/i,
  /\bwget\b.*(?:169\.254\.169\.254|metadata)/i,
  /\bnc\s+-l\b/,
  /\bncat\b/,
  /\/etc\/passwd/,
  /\/etc\/shadow/,
  />\s*\/dev\/sd/,
  /\bkill\s+-9\b/,
  /\breboot\b/,
  /\bshutdown\b/,
  /\$\(.*curl/i,
  /`.*curl/i
];

export function validateShellCommand(command) {
  const cmd = String(command || '').trim();
  if (!cmd) return { ok: false, reason: 'empty_command' };
  if (cmd.length > 2000) return { ok: false, reason: 'command_too_long' };
  for (const re of DENY_PATTERNS) {
    if (re.test(cmd)) return { ok: false, reason: `denied_pattern` };
  }
  const segments = cmd.split('|').map(s => s.trim()).filter(Boolean);
  for (const seg of segments) {
    const withoutEnv = seg.replace(/^([A-Za-z_][A-Za-z0-9_]*=\S+\s+)+/, '');
    const m = withoutEnv.match(/^([a-zA-Z0-9._+-]+)/);
    const token = m ? m[1] : '';
    if (!token || !ALLOWED_COMMANDS.has(token)) {
      return { ok: false, reason: `command_not_allowlisted:${token || '?'}` };
    }
  }
  return { ok: true };
}

export function isBlockedUrl(raw) {
  let u;
  try { u = new URL(raw); } catch { return 'invalid_url'; }
  if (!['http:', 'https:'].includes(u.protocol)) return 'protocol_not_allowed';
  const host = u.hostname.toLowerCase();
  const blocked = new Set(['169.254.169.254', 'metadata.google.internal', 'metadata.google', 'kubernetes.default', 'kubernetes.default.svc']);
  if (blocked.has(host)) return 'blocked_host';
  if (
    host === 'localhost' || host.endsWith('.local') || host === '0.0.0.0' ||
    /^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(host) || host === '::1'
  ) return 'private_or_local_host';
  return null;
}
