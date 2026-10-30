export function providerFailurePayload(error) {
  const raw = error instanceof Error ? error.message : String(error);
  const message = raw.replace(
    /\b(api[_-]?key|authorization|bearer)\s*[:=]?\s*(?:bearer\s+)?[^\s,;]+/gi,
    '$1=[redacted]'
  );
  return {
    error: 'provider_error',
    message: `The configured language model could not complete this turn. ${message.slice(0, 1200)}`
  };
}
