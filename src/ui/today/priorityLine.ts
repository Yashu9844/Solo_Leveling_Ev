import type { ArcState, CoreQuestKey, QuestInstance, QuestTemplate } from '../../engine/types';

// Deterministic, not adaptive — Slice 11 owns the rules-based version
// (engine/rules.ts, still a stub). This is plain presentation logic, not
// domain logic, so it lives in ui/ rather than engine/.
const CORE_ORDER: readonly CoreQuestKey[] = [
  'career',
  'dsa',
  'build',
  'training',
  'sleep',
  'attention',
];

/**
 * "Today: {title} at {intention.time}." for the first incomplete core
 * quest in fixed order, or "Today: {title}." if it has no intention.
 *
 * Slice 3 Step 0.4: "no active templates today" used to collapse into
 * the same "Six of six" line as "all complete" — genuinely different
 * states (one is a real celebration, the other is a screen with nothing
 * on it) sharing one misleading message. Now split four ways.
 */
export function priorityLine(
  templates: QuestTemplate[],
  instances: QuestInstance[],
  localDate: string,
  arc: Pick<ArcState, 'start_date' | 'end_date'> | null
): string {
  if (instances.length === 0) {
    if (arc && localDate < arc.start_date) {
      return `⟨ ARC INITIALIZATION ⟩ Arc begins ${arc.start_date}.`;
    }
    if (arc && localDate > arc.end_date) {
      return '⟨ ARC CONCLUDED ⟩ See your final report.';
    }
    return '⟨ NO ACTIVE QUESTS ⟩ System standing by.';
  }

  if (instances.every((i) => i.state === 'complete')) {
    return 'Six of six. Day closed.';
  }

  const templateByKey = new Map(templates.map((t) => [t.key, t]));
  const instanceByTemplateId = new Map(instances.map((i) => [i.template_id, i]));

  for (const key of CORE_ORDER) {
    const template = templateByKey.get(key);
    if (!template) continue;
    const instance = instanceByTemplateId.get(template.id);
    if (instance && instance.state !== 'complete') {
      return template.implementation_intention
        ? `⟨ ${template.title} ⟩ Required at ${template.implementation_intention.time}.`
        : `⟨ ${template.title} ⟩ Outstanding requirement.`;
    }
  }

  // Unreachable given the checks above, but keeps the function total.
  return 'No quests today.';
}
