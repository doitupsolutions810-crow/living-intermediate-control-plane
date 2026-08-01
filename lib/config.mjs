import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = join(__dirname, '..', 'config.json');

const DEFAULTS = {
  acceptLocalEvidenceByDefault: false,
  gateDoctorOnProcure: false,
  readinessIntervalMs: 30000,
  watchIntervalMs: 60000,
  decisionLogLimit: 20,
  planeName: 'living-intermediate-control-plane',
  securityValue: 'High'
};

export function loadConfig() {
  if (!existsSync(CONFIG_PATH)) return { ...DEFAULTS };
  try {
    const raw = JSON.parse(readFileSync(CONFIG_PATH, 'utf8'));
    return { ...DEFAULTS, ...raw };
  } catch {
    return { ...DEFAULTS };
  }
}
