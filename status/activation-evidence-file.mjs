/**
 * Shared, fail-closed loader for operator-supplied activation evidence.
 * POSIX production files must be regular, service-account-owned, private,
 * non-executable, and small. Opens with O_NOFOLLOW to avoid symlink races.
 */
import {
  closeSync,
  constants as fsConstants,
  fstatSync,
  openSync,
  readFileSync
} from 'node:fs';

export const MAX_ACTIVATION_EVIDENCE_BYTES = 256 * 1024;

export function readActivationEvidenceFile(path) {
  if (typeof path !== 'string' || !path.trim()) return null;
  let fd = null;
  try {
    const isPosix = process.platform !== 'win32';
    // Fail closed if this platform cannot atomically refuse symlinks.
    if (isPosix && typeof fsConstants.O_NOFOLLOW !== 'number') return null;
    const flags = fsConstants.O_RDONLY | (isPosix ? fsConstants.O_NOFOLLOW : 0);
    fd = openSync(path, flags);
    const metadata = fstatSync(fd);
    if (!metadata.isFile() || metadata.size <= 0 || metadata.size > MAX_ACTIVATION_EVIDENCE_BYTES) return null;

    if (isPosix) {
      const serviceUid = typeof process.geteuid === 'function' ? process.geteuid() : null;
      if (serviceUid === null || metadata.uid !== serviceUid) return null;
      const permissions = metadata.mode & 0o777;
      if ((permissions & 0o077) !== 0 || (permissions & 0o400) === 0 || (permissions & 0o111) !== 0) return null;
    }

    const parsed = JSON.parse(readFileSync(fd, 'utf8'));
    return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  } finally {
    if (fd !== null) {
      try { closeSync(fd); } catch { /* descriptor may already be closed */ }
    }
  }
}
