import type { ArchetypeDef } from './types';

/** Staying under a spending limit, and looking at the accounts on a rhythm. The limit is the person's. */
export const financeControl: ArchetypeDef = {
  id: 'finance-control', area: 'financial', label: 'Finance control', version: 1,
  role: 'guardrail', weight: 1, headroom: 'guardrail',
  designations: ['TREASURY WARD', 'VAULT WARD', 'LEDGER WARD'],
  name: 'Spending', description: 'Spending under the limit, and the accounts looked at.', channel: 'TREASURY',
  instruments: [
    {
      // target is replaced with the person's daily limit when the domain is built.
      key: 'main', type: 'threshold', label: 'Spending', logVerb: 'Log Spending',
      params: { unit: 'spend', comparator: '<=', target: 1000, entryLabel: 'Spent today', hint: 'Everything spent today, in your own currency.', defaultValue: 750 },
    },
    { key: 'review', type: 'checklist', label: 'Account review', logVerb: 'Tick Review', params: { items: [{ id: 'accounts', label: 'Accounts reviewed', everyNDays: 7 }] } },
  ],
  quest: {
    objective: '{target} or under spent today.',
    realityLabel: 'spending ≤ {target}',
    criterion: { kind: 'signal', instrument: 'main', signal: 'hit', comparator: '>=', target: 1, min: 1 },
    floor: 'same', schedule: { kind: 'daily' }, evidenceMode: 'self_report_allowed', recoverable: true, intentionAllowed: false,
  },
  presentation: { icon: 'Wallet', hue: 'green' },

  metrics: [
    { key: 'spend', label: 'Daily spending', unit: 'per day', kind: 'effort', direction: 'lower', source: { instrument: 'main', signal: 'mean_value', aggregate: 'window_28' } },
    { key: 'reviews', label: 'Account reviews', unit: 'days', kind: 'effort', direction: 'higher', source: { instrument: 'review', signal: 'all_done_days', aggregate: 'total' } },
  ],
  conditions: [
    {
      id: 'spend', short: 'Daily spending', label: 'Spending {0}/day (need <= {t0})', verifiability: 'recorded', comparator: '<=', format: 'round',
      signal: { instrument: 'main', signal: 'mean_value_failsafe', aggregate: 'window_28' }, at: { A: { param: 'target', instrument: 'main', scale: 1.1 }, S: { param: 'target', instrument: 'main' } },
    },
    {
      id: 'reviews', short: 'Account reviews', label: '{0} account reviews kept (need {t0})', verifiability: 'recorded', comparator: '>=', format: 'int',
      signal: { instrument: 'review', signal: 'all_done_days', aggregate: 'total' }, at: { A: 6, S: 12 },
    },
  ],
  checkpoint: { selfEfficacy: 'Stay under your limit through a week with a temptation in it?', enjoyment: 'The accounts' },
  reviewPrompt: { prompt: 'What drove today\'s spending?', options: ['Planned', 'Convenience', 'Impulse', 'Nothing was spent'] },
  reflectionThemes: ['money', 'restraint'],
};
