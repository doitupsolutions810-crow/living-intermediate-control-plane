/**
 * Redact secrets and credential-like strings before tool output
 * is returned to the model or user.
 */

const SECRET_PATTERNS: RegExp[] = [
  /\b(?:sk|pk|rk|xai|gsk)[-_][A-Za-z0-9]{16,}\b/gi,
  /\b(?:api[_-]?key|token|secret|password|authorization)\s*[:=]\s*['"]?[^\s'"]{8,}/gi,
  /\bBearer\s+[A-Za-z0-9\-._~+/]+=*/gi,
  /\b(?:CONTROL12_PLATFORM_TOKEN|XAI_API_KEY|OPENAI_API_KEY|GROK_API_KEY|TAVILY_API_KEY)\s*=\s*\S+/gi,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g
];

export function scrubSecrets(text: string, maxLen = 24_000): string {
  let out = String(text ?? '');
  for (const re of SECRET_PATTERNS) {
    out = out.replace(re, '[REDACTED]');
  }
  if (out.length > maxLen) {
    out = out.slice(0, maxLen) + `\n…[truncated ${out.length - maxLen} chars]`;
  }
  return out;
}
