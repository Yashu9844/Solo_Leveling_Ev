// S8 attributes (platform/02 §11): DISCIPLINE is global - showing up, and the guardrails kept - and every
// engine adds the one attribute its archetype describes. Three to six in all, in at most three groups.
import { glob, ratio } from '../blueprint/build';
import type { AttributeDef, AttributeGroupDef, QuestTemplateDef } from '../blueprint/schema';
import { ratioOfTerm, signalOf, WINDOW_DAYS, type DomainContext } from './derive';

export const MAX_ATTRIBUTES = 6;

const GROUPS: Record<'mind' | 'craft' | 'body', AttributeGroupDef> = {
  mind: { id: 'mind', heading: 'MIND', tagline: 'A SHARPER YOU', layout: 'mind', icon: 'Brain' },
  craft: { id: 'craft', heading: 'CRAFT', tagline: 'BUILD SKILLS. BUILD OPTIONS.', layout: 'craft', icon: 'Cpu' },
  body: { id: 'body', heading: 'BODY', tagline: 'A STRONGER YOU', layout: 'body', icon: 'Barbell' },
};

const E28 = 'eligible_28' as const;

/** Splits `total` over shares in steps of 0.05, the largest remainder fixing the sum: 0.36/0.24 -> 0.35/0.25. */
function roundShares(total: number, shares: number[]): number[] {
  const unit = 0.05;
  const whole = shares.map((share) => Math.floor((share * total) / unit + 1e-9));
  const target = Math.round(total / unit);
  const remainders = shares.map((share, index) => ({ index, rest: (share * total) / unit - whole[index]! })).sort((a, b) => b.rest - a.rest || a.index - b.index);
  let left = target - whole.reduce((sum, w) => sum + w, 0);
  for (const { index } of remainders) {
    if (left <= 0) break;
    whole[index]! += 1;
    left--;
  }
  return whole.map((w) => Math.round(w * unit * 100) / 100);
}

/** DISCIPLINE: 0.40 minimum-viable days, 0.60 across the guardrails by their XP share. */
function discipline(contexts: DomainContext[], quests: QuestTemplateDef[]): AttributeDef {
  const guardrails = contexts.filter((ctx) => ctx.resolved.archetype.role === 'guardrail' && quests.some((quest) => quest.domainId === ctx.domain.id));
  const mvdWeight = guardrails.length === 0 ? 1 : 0.4;
  const terms: AttributeDef['terms'] = [{
    id: 'mvd', label: 'MVD days', weight: mvdWeight, signal: ratio(glob('completion_days', undefined, E28), WINDOW_DAYS), transform: { kind: 'rate' },
  }];
  if (guardrails.length > 0) {
    const xp = guardrails.map((ctx) => quests.find((quest) => quest.domainId === ctx.domain.id)!.xp);
    const totalXp = xp.reduce((sum, value) => sum + value, 0) || 1;
    const weights = roundShares(0.6, xp.map((value) => value / totalXp));
    guardrails.forEach((ctx, index) => {
      const quest = quests.find((candidate) => candidate.domainId === ctx.domain.id)!;
      terms.push({
        id: ctx.domain.id, label: `${ctx.domain.name} hits`, weight: weights[index]!,
        signal: ratio({ source: 'quest', questId: quest.id, signal: 'completed_days', aggregate: E28 }, WINDOW_DAYS), transform: { kind: 'rate' },
      });
    });
  }
  return { id: 'DISCIPLINE', name: 'DISCIPLINE', groupId: 'mind', description: 'Showing up: minimum-viable days, and the guardrails kept.', combine: 'sum', terms };
}

export function buildAttributes(contexts: DomainContext[], quests: QuestTemplateDef[]): { groups: AttributeGroupDef[]; defs: AttributeDef[] } {
  const defs: AttributeDef[] = [discipline(contexts, quests)];
  const used = new Set(['DISCIPLINE']);
  for (const ctx of contexts) {
    const template = ctx.resolved.archetype.attribute;
    if (!template || ctx.resolved.archetype.role !== 'engine' || defs.length >= MAX_ATTRIBUTES || used.has(template.id)) continue;
    used.add(template.id);
    defs.push({
      id: template.id, name: template.name, groupId: template.group, description: template.description, combine: template.combine,
      ...(template.productKey ? { productKey: template.productKey } : {}),
      terms: template.terms.map((term) => ({
        id: term.id, label: term.label, weight: term.weight,
        signal: ratioOfTerm(signalOf(term.signal, ctx.ids), term.ratioOf, ctx.ids), transform: term.transform,
      })),
    });
  }
  const groupIds = [...new Set(defs.map((definition) => definition.groupId))] as ('mind' | 'craft' | 'body')[];
  const groups = (['mind', 'craft', 'body'] as const).filter((id) => groupIds.includes(id)).map((id) => ({ ...GROUPS[id] }));
  return { groups, defs };
}
