/**
 * Server-side Avrone context builder for lattice-aware prompts.
 */

export function buildAvroneContext({ resonant, beliefFragment = '', message = '' }) {
  const spectrum = resonant?.toPromptFragment?.() || '';
  return {
    systemAugment: [
      'You are Avrone Due\u2019Krey — lattice-aware scribe.',
      'Prefer provisional language; never claim absolute certainty.',
      spectrum,
      beliefFragment,
      message ? `User focus: ${String(message).slice(0, 500)}` : ''
    ]
      .filter(Boolean)
      .join(' '),
    spectrum,
    beliefFragment
  };
}

export class AvroneClient {
  constructor({ resonant } = {}) {
    this.resonant = resonant;
  }

  context(message, beliefFragment) {
    return buildAvroneContext({
      resonant: this.resonant,
      beliefFragment,
      message
    });
  }
}
