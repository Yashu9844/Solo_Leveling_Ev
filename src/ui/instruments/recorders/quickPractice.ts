// "Practice" on a skill-tree node (platform/03 §27.3): minutes against one topic, from the
// Skills screen. The owner's trees have always logged a learning block for it; a generic tree
// records a study block on its own instrument. A practice_item tree needs the full item sheet
// (an outcome, a difficulty), so it offers no quick practice.
import type { InstrumentConfig, SkillTreeDef, SystemBlueprint } from '../../../blueprint/schema';
import { logQuickSkillPractice } from '../../../store/skills';
import { realDeps } from '../../../store/deps';
import { getEngineConfig } from '../../../store/engineConfig';
import { recordStudy } from './studyBlock';

function instrumentOf(blueprint: SystemBlueprint, tree: SkillTreeDef): InstrumentConfig | undefined {
  return blueprint.instruments.find((candidate) => candidate.id === tree.instrumentId);
}

/** Whether a node of this tree can be practised from a one-line form. */
export function canQuickPractice(blueprint: SystemBlueprint, tree: SkillTreeDef): boolean {
  const instrument = instrumentOf(blueprint, tree);
  return instrument?.eventBinding.kind === 'legacy' || instrument?.type === 'study_block';
}

export async function quickPractice(
  blueprint: SystemBlueprint,
  tree: SkillTreeDef,
  topic: string,
  minutes: number,
  note: string | undefined,
  ctx: { today: string; arcId: string }
): Promise<void> {
  const instrument = instrumentOf(blueprint, tree);
  if (!instrument) throw new Error(`"${tree.id}" has no instrument to practise against.`);
  if (instrument.eventBinding.kind === 'legacy') {
    await logQuickSkillPractice(ctx.today, ctx.arcId, topic, minutes, getEngineConfig(), realDeps, note);
    return;
  }
  const node = tree.nodes.find((candidate) => candidate.name === topic);
  await recordStudy(instrument, undefined, { topic: node?.id ?? topic, minutes, note }, ctx);
}
