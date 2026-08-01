import crypto from 'node:crypto';

export class CodingQuorum {
  constructor({ coding, attestationDir = null } = {}) {
    this.coding = coding;
    this.attestationDir = attestationDir;
  }

  async run({ goal, path = null, content = null, command = null }) {
    if (!goal) {
      throw Object.assign(new Error('goal required'), { statusCode: 400 });
    }
    const evidence = [];
    let codeResult = null;

    if (path != null && content != null) {
      try {
        codeResult = command
          ? await this.coding.produceAndRun({ path, content, command })
          : { written: await this.coding.writeFile(path, content), execution: null };
        evidence.push({ key: 'coder.write', present: true, path });
        if (codeResult.execution) {
          evidence.push({
            key: 'coder.terminal',
            present: true,
            exitCode: codeResult.execution.code
          });
        }
      } catch (e) {
        evidence.push({ key: 'coder.write', present: false, error: e.message });
      }
    } else if (command) {
      try {
        const execution = await this.coding.execute(command);
        codeResult = { written: null, execution };
        evidence.push({ key: 'coder.terminal', present: true, exitCode: execution.code });
      } catch (e) {
        evidence.push({ key: 'coder.terminal', present: false, error: e.message });
      }
    }

    const failed = evidence.filter(e => e.present === false);
    const terminalFail =
      codeResult?.execution && codeResult.execution.code != null && codeResult.execution.code !== 0;
    const decision =
      failed.length || terminalFail ? 'NOT_READY' : codeResult ? 'READY' : 'UNKNOWN';

    const evidenceRecord = {
      schema: 'control12.evidence/v1',
      kind: 'coding-quorum',
      subject: String(goal).slice(0, 200),
      at: new Date().toISOString(),
      policyDecision: { decision },
      digests: { evidenceKeys: evidence.map(e => e.key) }
    };
    evidenceRecord.recordDigest = crypto
      .createHash('sha256')
      .update(JSON.stringify(evidenceRecord))
      .digest('hex');

    return {
      status: 'CODING_QUORUM_COMPLETE',
      goal,
      evidence,
      verification: { decision, failedGates: failed.map(e => e.key) },
      evidenceRecord,
      readiness: { ok: decision === 'READY', failures: failed.map(e => e.key) },
      codeResult
    };
  }
}

export default CodingQuorum;
