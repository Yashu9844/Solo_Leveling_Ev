// S12 reviews, rules, messaging, reality (platform/02 §17-18, §12). Everything the System says back to the person
// is built here from the same domains: a prompt per domain for the evening review, the weekly review's headline
// numbers, the rules that notice a pattern, the evidence lines the System can say, and the REALITY panel.
import { glob } from '../blueprint/build';
import type { MessagingDef, RealityRowDef, ReviewDef, RuleDef, SignalRef } from '../blueprint/schema';
import { signalOf, type DomainContext } from './derive';

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
  return {
    evidenceTemplates: contexts.flatMap((ctx) => {
      const ladder = ctx.resolved.archetype.ladder;
      return ladder ? [{ id: `${ctx.domain.id}.${ladder.key}`, tier: 'P3' as const, signal: signalOf(ladder.signal, ctx.ids), template: `{n} ${ladder.noun} on record.` }] : [];
    }),
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
