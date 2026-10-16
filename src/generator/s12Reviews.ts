// S12 reviews, rules, messaging, reality (platform/02 §17-18, §12). Everything the System says back to the person
// is built here from the same domains: a prompt per domain for the evening review, the weekly review's headline
// numbers, the rules that notice a pattern, the evidence lines the System can say, and the REALITY panel.
import { glob } from '../blueprint/build';
import type { MessagingDef, RealityRowDef, ReviewDef, RuleDef, SignalRef } from '../blueprint/schema';
import type { CriterionTemplate } from '../library/archetypes/types';
import { signalOf, type DomainContext } from './derive';

type SignalLeaf = Extract<CriterionTemplate, { kind: 'signal' }>;
const leavesOf = (criterion: CriterionTemplate): SignalLeaf[] => (criterion.kind === 'signal' ? [criterion] : criterion.of.flatMap(leavesOf));

/**
 * What a domain does every day, as a signal and in words: the number its quest asks for (minutes, pages, problems). A record or a trend is
 * said about THIS - a shipped unit is too rare to be a day's record - and the unit is the name of the archetype's own metric for it.
 */
function dailySignal(ctx: DomainContext): { signal: SignalRef; unit: string } | undefined {
  const archetype = ctx.resolved.archetype;
  if (!archetype.quest) return undefined;
  const leaves = leavesOf(archetype.quest.criterion);
  const leaf = leaves.find((candidate) => candidate.answer === 'goodDay') ?? leaves[0];
  if (!leaf) return undefined;
  const same = (a: Record<string, string> | undefined, b: Record<string, string> | undefined) => JSON.stringify(a ?? {}) === JSON.stringify(b ?? {});
  const metric = archetype.metrics?.find((candidate) => 'instrument' in candidate.source && candidate.source.instrument === leaf.instrument && candidate.source.signal === leaf.signal && same(candidate.source.filter, leaf.filter));
  const unit = (metric?.label ?? archetype.ladder?.noun)?.toLowerCase();
  return unit ? { signal: signalOf({ instrument: leaf.instrument, signal: leaf.signal, aggregate: 'total', ...(leaf.filter ? { filter: leaf.filter } : {}) }, ctx.ids), unit } : undefined;
}

/** The same signal over the last seven days instead of the whole arc. */
function weekly(signal: SignalRef): SignalRef {
  if (signal.source === 'instrument' && signal.aggregate === 'total') return { ...signal, aggregate: 'window_7' };
  return signal;
}

export function buildReviews(contexts: DomainContext[]): ReviewDef {
  const engines = contexts.filter((ctx) => ctx.resolved.archetype.role === 'engine' && ctx.resolved.archetype.ladder);
  return {
    domainPrompts: contexts.flatMap((ctx) => {
      const prompt = ctx.resolved.archetype.reviewPrompt;
      return prompt ? [{ id: `${ctx.domain.id}.review`, domainId: ctx.domain.id, prompt: prompt.prompt, options: [...prompt.options] }] : [];
    }),
    weeklyMetrics: [
      { key: 'xpEarned', label: 'XP earned', signal: glob('xp_earned', undefined, 'window_7') },
      ...engines.map((ctx): RealityRowDef => ({ key: `${ctx.domain.id}.${ctx.resolved.archetype.ladder!.key}`, label: ctx.resolved.archetype.ladder!.label, signal: weekly(signalOf(ctx.resolved.archetype.ladder!.signal, ctx.ids)) })),
    ],
  };
}

export function buildRules(contexts: DomainContext[], hasSkills: boolean): RuleDef[] {
  const rules: RuleDef[] = [];
  const durations = contexts.flatMap((ctx) => ctx.instruments).filter((instrument) => instrument.type === 'duration' && Array.isArray(instrument.params.modes));
  const build = durations.find((instrument) => (instrument.params.modes as string[]).includes('LEARN') && (instrument.params.modes as string[]).includes('SHIP'));
  if (build) rules.push({ id: 'learn-ship', kind: 'MODE_RATIO', enabled: true, params: { instrumentId: build.id, ratio: 3, windowDays: 14 } });
  // Any other duration that names its input and output modes gets the same ratio rule (a creative: study vs make).
  for (const instrument of durations) {
    const { inputMode, outputMode } = instrument.params as { inputMode?: unknown; outputMode?: unknown };
    if (instrument === build || typeof inputMode !== 'string' || typeof outputMode !== 'string') continue;
    rules.push({ id: `input-output.${instrument.domainId}`, kind: 'MODE_RATIO', enabled: true, params: { instrumentId: instrument.id, inputMode, outputMode, ratio: 3, windowDays: 14 } });
  }
  rules.push({ id: 'wrong-time', kind: 'WRONG_TIME', enabled: true, params: { count: 3, windowDays: 14 } });
  if (contexts.some((ctx) => ctx.instruments.some((instrument) => instrument.type === 'pipeline'))) {
    rules.push({ id: 'substitute-share', kind: 'SUBSTITUTE_SHARE', enabled: false }, { id: 'low-conversion', kind: 'LOW_CONVERSION', enabled: false });
  }
  if (hasSkills) rules.push({ id: 'weakest-topic', kind: 'WEAKEST_TOPIC', enabled: false });
  return rules;
}

export function buildMessaging(contexts: DomainContext[]): MessagingDef {
  const themes = [...new Set(contexts.flatMap((ctx) => ctx.resolved.archetype.reflectionThemes ?? []))];
  const engines = contexts.filter((ctx) => ctx.domain.role === 'engine' && ctx.resolved.archetype.headroom !== 'guardrail' && dailySignal(ctx));
  const guardrail = contexts.find((ctx) => ctx.domain.role === 'guardrail' && ctx.resolved.archetype.id === 'sleep-regularity') ?? contexts.find((ctx) => ctx.domain.role === 'guardrail');
  const lead = [...engines].sort((a, b) => a.domain.priority - b.domain.priority)[0];
  return {
    evidenceTemplates: [
      ...contexts.flatMap((ctx) => {
        const ladder = ctx.resolved.archetype.ladder;
        return ladder ? [{ id: `${ctx.domain.id}.${ladder.key}`, tier: 'P3' as const, signal: signalOf(ladder.signal, ctx.ids), template: "{value} {unit} on record.", domainId: ctx.domain.id, unit: ladder.noun }] : [];
      }),
      // The engines' own numbers: a day that beats every earlier day, and a fortnight that beats the one before. Said with the domain's own name.
      ...engines.flatMap((ctx) => {
        const { signal, unit } = dailySignal(ctx)!;
        return [
          { id: `${ctx.domain.id}.record`, tier: 'P1' as const, kind: 'record' as const, signal, domainId: ctx.domain.id, unit, template: '{label}: most {unit} in a day yet, {value}.' },
          { id: `${ctx.domain.id}.trend`, tier: 'P2' as const, kind: 'trend' as const, signal, domainId: ctx.domain.id, unit, template: '{label}: {current} {unit} over 14 days, up from {previous}.' },
        ];
      }),
      // What a kept guardrail does for the lead engine, from the person's own days: only when the kept days do better.
      ...(lead && guardrail ? [{
        id: `${lead.domain.id}.after.${guardrail.domain.id}`, tier: 'P3' as const, kind: 'correlation' as const, signal: dailySignal(lead)!.signal, domainId: lead.domain.id, withDomainId: guardrail.domain.id,
        template: '{label} done the day after a kept {with}: {a}%. After a miss: {b}%.',
      }] : []),
    ],
    reflectionThemes: themes.length > 0 ? themes : ['consistency', 'recovery'],
  };
}

/** The REALITY panel: each engine's headline count, the rates and outcomes the archetype records. Nothing here is scored. */
export function buildReality(contexts: DomainContext[]): RealityRowDef[] {
  const rows: RealityRowDef[] = [];
  for (const ctx of contexts) {
    const archetype = ctx.resolved.archetype;
    if (archetype.ladder) rows.push({ key: `${ctx.domain.id}.${archetype.ladder.key}`, label: archetype.ladder.label, signal: signalOf(archetype.ladder.signal, ctx.ids) });
    for (const metric of archetype.metrics ?? []) {
      if ('manual' in metric.source || metric.kind === 'body') continue;
      if (metric.source.signal === archetype.ladder?.signal.signal && metric.source.instrument === archetype.ladder?.signal.instrument) continue;
      const isRate = metric.unit === '%';
      rows.push({
        key: `${ctx.domain.id}.${metric.key}`, label: metric.label, signal: signalOf(metric.source, ctx.ids),
        ...(isRate ? { display: { format: 'percent' as const, dashWhenZero: true, day0: '—' } } : {}),
      });
    }
  }
  return rows;
}
