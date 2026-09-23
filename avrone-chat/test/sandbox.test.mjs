import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validateShellCommand, isBlockedUrl } from '../lib/sandbox-shell-rules.mjs';

describe('sandbox shell allow/deny', () => {
  it('allows benign commands', () => {
    assert.equal(validateShellCommand('ls -la').ok, true);
    assert.equal(validateShellCommand('pwd').ok, true);
    assert.equal(validateShellCommand('echo hello | wc -c').ok, true);
    assert.equal(validateShellCommand('date').ok, true);
  });

  it('denies dangerous patterns', () => {
    assert.equal(validateShellCommand('rm -rf /').ok, false);
    assert.equal(validateShellCommand('sudo ls').ok, false);
    assert.equal(validateShellCommand('curl http://169.254.169.254/latest/meta-data/').ok, false);
    assert.equal(validateShellCommand('cat /etc/shadow').ok, false);
    assert.equal(validateShellCommand('reboot').ok, false);
  });

  it('denies non-allowlisted binaries', () => {
    assert.equal(validateShellCommand('python3 -c "print(1)"').ok, false);
    assert.equal(validateShellCommand('bash -c "id"').ok, false);
    assert.equal(validateShellCommand('curl https://example.com').ok, false);
  });

  it('rejects empty', () => {
    assert.equal(validateShellCommand('').ok, false);
  });
});

describe('research URL blocklist', () => {
  it('blocks metadata and private hosts', () => {
    assert.equal(isBlockedUrl('http://169.254.169.254/latest/meta-data/'), 'blocked_host');
    assert.equal(isBlockedUrl('http://localhost:8787/health'), 'private_or_local_host');
    assert.equal(isBlockedUrl('http://127.0.0.1/'), 'private_or_local_host');
    assert.equal(isBlockedUrl('http://192.168.1.1/'), 'private_or_local_host');
    assert.equal(isBlockedUrl('file:///etc/passwd'), 'protocol_not_allowed');
  });

  it('allows public https', () => {
    assert.equal(isBlockedUrl('https://example.com/path'), null);
    assert.equal(isBlockedUrl('https://api.tavily.com/search'), null);
  });
});
