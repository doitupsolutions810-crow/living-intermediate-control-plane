import assert from 'node:assert/strict';
import test from 'node:test';
import { chmodSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MAX_ACTIVATION_EVIDENCE_BYTES, readActivationEvidenceFile } from '../status/activation-evidence-file.mjs';

function tempDir(t) {
  const directory = mkdtempSync(join(tmpdir(), 'avrone-activation-evidence-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  return directory;
}
function writePrivate(path, data = JSON.stringify({ schema: 'avrone.activation-evidence/v1' })) {
  writeFileSync(path, data);
  if (process.platform !== 'win32') chmodSync(path, 0o600);
  return path;
}

test('accepts a private, regular, well-formed evidence file owned by the service account', t => {
  const dir = tempDir(t);
  const file = writePrivate(join(dir, 'evidence.json'));
  assert.equal(readActivationEvidenceFile(file)?.schema, 'avrone.activation-evidence/v1');
});

test('rejects group/world-readable evidence on POSIX', t => {
  if (process.platform === 'win32') return t.skip('POSIX permission model only');
  const dir = tempDir(t);
  const file = writePrivate(join(dir, 'evidence.json'));
  chmodSync(file, 0o644);
  assert.equal(readActivationEvidenceFile(file), null);
});

test('rejects symlinked evidence on POSIX', t => {
  if (process.platform === 'win32') return t.skip('O_NOFOLLOW POSIX assertion');
  const dir = tempDir(t);
  const target = writePrivate(join(dir, 'target.json'));
  const link = join(dir, 'link.json');
  symlinkSync(target, link);
  assert.equal(readActivationEvidenceFile(link), null);
});

test('rejects directories, missing files, and malformed JSON', t => {
  const dir = tempDir(t);
  const subdir = join(dir, 'folder');
  mkdirSync(subdir);
  const malformed = writePrivate(join(dir, 'malformed.json'), '{');
  assert.equal(readActivationEvidenceFile(subdir), null);
  assert.equal(readActivationEvidenceFile(join(dir, 'missing.json')), null);
  assert.equal(readActivationEvidenceFile(malformed), null);
});

test('rejects evidence larger than the bounded file size', t => {
  const dir = tempDir(t);
  const file = join(dir, 'oversized.json');
  writePrivate(file, '{"payload":"' + 'x'.repeat(MAX_ACTIVATION_EVIDENCE_BYTES) + '"}');
  assert.equal(readActivationEvidenceFile(file), null);
});

test('rejects JSON primitives and arrays', t => {
  const dir = tempDir(t);
  assert.equal(readActivationEvidenceFile(writePrivate(join(dir, 'array.json'), '[]')), null);
  assert.equal(readActivationEvidenceFile(writePrivate(join(dir, 'string.json'), '"ready"')), null);
});
