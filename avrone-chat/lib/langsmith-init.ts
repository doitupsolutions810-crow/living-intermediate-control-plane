/**
 * Optional LangSmith / LangChain tracing bootstrap.
 *
 * Official env vars (LangChain already reads these — no SDK required to build/run):
 *   LANGCHAIN_TRACING_V2=true   (or LANGSMITH_TRACING=true / LANGSMITH_TRACING_V2=true)
 *   LANGCHAIN_API_KEY=...       (or LANGSMITH_API_KEY=...)
 *   LANGCHAIN_PROJECT=avrone    (optional project name)
 *
 * When tracing is off or no API key is set, this is a no-op and graphs run untraced.
 * Call once at module load from langgraph-agent (gated, cheap).
 */

function envTrim(name: string): string {
  return (process.env[name] || '').trim();
}

function isTrue(name: string): boolean {
  return envTrim(name).toLowerCase() === 'true';
}

function hasApiKey(): boolean {
  return Boolean(envTrim('LANGCHAIN_API_KEY') || envTrim('LANGSMITH_API_KEY'));
}

/** True when any official tracing flag is "true". */
export function isLangSmithTracingRequested(): boolean {
  return (
    isTrue('LANGCHAIN_TRACING_V2') ||
    isTrue('LANGSMITH_TRACING') ||
    isTrue('LANGSMITH_TRACING_V2') ||
    isTrue('LANGCHAIN_TRACING')
  );
}

/**
 * Normalize LANGSMITH_* ↔ LANGCHAIN_* so either naming works.
 * Does not enable tracing by itself; does not throw when key missing.
 */
export function ensureLangSmithEnv(): { tracing: boolean; keyed: boolean } {
  const tracing = isLangSmithTracingRequested();
  if (!tracing) {
    return { tracing: false, keyed: hasApiKey() };
  }

  // Prefer both flags set when either is true (LangChain checks several names).
  if (!isTrue('LANGCHAIN_TRACING_V2')) {
    process.env.LANGCHAIN_TRACING_V2 = 'true';
  }
  if (!isTrue('LANGSMITH_TRACING')) {
    process.env.LANGSMITH_TRACING = 'true';
  }

  const lcKey = envTrim('LANGCHAIN_API_KEY');
  const lsKey = envTrim('LANGSMITH_API_KEY');
  if (!lcKey && lsKey) {
    process.env.LANGCHAIN_API_KEY = lsKey;
  }
  if (!lsKey && lcKey) {
    process.env.LANGSMITH_API_KEY = lcKey;
  }

  if (!envTrim('LANGCHAIN_PROJECT') && !envTrim('LANGSMITH_PROJECT')) {
    process.env.LANGCHAIN_PROJECT = envTrim('AVRONE_LANGSMITH_PROJECT') || 'avrone-chat';
  }

  return { tracing: true, keyed: hasApiKey() };
}
