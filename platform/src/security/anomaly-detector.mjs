import fs from 'node:fs/promises';

export async function analyzeAccessLog(file, { min401 = 20 } = {}) {
  let lines = [];
  try {
    const text = await fs.readFile(file, 'utf8');
    lines = text.trim().split('\n').filter(Boolean).slice(-3000);
  } catch {
    return { severity: 'ok', findings: [], sampled: 0 };
  }
  let status401 = 0;
  let sensitiveOk = 0;
  let postNone = 0;
  for (const line of lines) {
    let row;
    try {
      row = JSON.parse(line);
    } catch {
      continue;
    }
    if (row.status === 401) status401 += 1;
    if (row.method === 'POST' && row.auth === 'none') postNone += 1;
    if (
      row.status < 400 &&
      typeof row.path === 'string' &&
      /\/api\/v1\/(code|terminal)/.test(row.path)
    ) {
      sensitiveOk += 1;
    }
  }
  const findings = [];
  if (status401 >= min401) findings.push('elevated_401');
  if (sensitiveOk > 0) findings.push('sensitive_route_success');
  if (postNone > 0) findings.push('post_auth_none');
  const high = findings.some(f => ['sensitive_route_success', 'post_auth_none'].includes(f));
  return {
    severity: high ? 'high' : findings.length ? 'elevated' : 'ok',
    findings,
    sampled: lines.length,
    status401,
    sensitiveOk,
    postNone
  };
}
