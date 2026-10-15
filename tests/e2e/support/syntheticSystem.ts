// A System that is not the owner's, for the screens to render (platform/05 loop 7.9).
//
// It is the owner's Blueprint with every word, glyph and hue the screens read replaced - domains,
// quests, groups, trees, reality rows - and the legacy marker removed, so every screen takes its
// non-legacy path: Blueprint names instead of the owner's copy, the generic attribute screen, the
// milestone panel, hue tokens beyond the two the owner uses. The instruments are the owner's
// (their ids are what the stores write against); fully generic instruments are exercised by
// tests/engine/instrument-recorders.test.ts and arrive with generated Systems (Phase 8).
import { activationEvent } from '../../../src/blueprint/activation';
import { legacyBlueprintFor, OWNER_ARC_DEFAULTS } from '../../../src/blueprint/legacy/legacyV1';
import type { SystemBlueprint } from '../../../src/blueprint/schema';
import type { SystemEvent } from '../../../src/engine/types';
import { LEGACY_ARC_ID, legacyActivityLog } from '../../engine/support/legacyActivityLog';

export const SYNTHETIC_DOMAINS: Record<string, { name: string; designation: string; icon: string; hue: string; logVerb: string }> = {
  career: { name: 'Outreach', designation: 'HERALD', icon: 'Compass', hue: 'teal', logVerb: 'Log Outreach' },
  dsa: { name: 'Puzzles', designation: 'RIDDLE', icon: 'Lightbulb', hue: 'amber', logVerb: 'Log Riddle' },
  build: { name: 'Making', designation: 'ANVIL', icon: 'Hammer', hue: 'coral', logVerb: 'Log Making' },
  training: { name: 'Motion', designation: 'SINEW', icon: 'Heartbeat', hue: 'green', logVerb: 'Log Motion' },
  sleep: { name: 'Rest', designation: 'DUSK', icon: 'Leaf', hue: 'rose', logVerb: 'Log Rest' },
  attention: { name: 'Focus', designation: 'HALCYON', icon: 'Timer', hue: 'slate', logVerb: 'Log Focus' },
  foundations: { name: 'Study', designation: 'LORE', icon: 'Books', hue: 'blue', logVerb: 'Log Lore' },
  maintenance: { name: 'Upkeep', designation: 'CHORES', icon: 'Broom', hue: 'violet', logVerb: 'Tick Chores' },
};

const GROUPS: Record<string, { heading: string; tagline: string; icon: string }> = {
  mind: { heading: 'HEAD', tagline: 'THINK CLEARLY', icon: 'Lightbulb' },
  craft: { heading: 'HANDS', tagline: 'MAKE THINGS', icon: 'Hammer' },
  body: { heading: 'HEART', tagline: 'KEEP MOVING', icon: 'Heartbeat' },
};

const REALITY_LABELS: Record<string, string> = {
  problems: 'Riddles solved', firstAttemptRateM: 'Clean solves', publicProjects: 'Public builds', evals: 'Eval suites',
  applications: 'Outreach sent', qualityRate: 'Outreach quality', followThroughRate: 'Follow-through', foundationsFluentOrBetter: 'Lore mastered',
};

/** `locks`: features that open at levels the seeded player has not reached (the 40-day log ends around level 19). */
export function syntheticBlueprint({ locks = false }: { locks?: boolean } = {}): SystemBlueprint {
  const blueprint = legacyBlueprintFor({ ...OWNER_ARC_DEFAULTS, id: LEGACY_ARC_ID });
  delete blueprint.origin;
  if (locks) blueprint.progression.unlocks = { attributes: 60, weekly_review: 60, bosses: 60, weekly_quests: 3, skills: 10 };
  blueprint.lineageId = 'synthetic-lineage';
  for (const domain of blueprint.domains) {
    const skin = SYNTHETIC_DOMAINS[domain.id]!;
    domain.name = skin.name;
    domain.designation = skin.designation;
    domain.description = `${skin.name}, in the synthetic System.`;
    domain.presentation = { icon: skin.icon, hue: skin.hue };
    delete domain.shortcut;
  }
  for (const quest of blueprint.quests) {
    const skin = SYNTHETIC_DOMAINS[quest.domainId]!;
    quest.designation = skin.designation;
    quest.realityLabel = `${skin.name.toLowerCase()} for the day`;
    quest.objective = `Do today's ${skin.name.toLowerCase()}.`;
  }
  for (const instrument of blueprint.instruments) {
    const skin = SYNTHETIC_DOMAINS[instrument.domainId]!;
    instrument.logVerb = skin.logVerb;
    instrument.label = `${skin.name} log`;
  }
  for (const group of blueprint.attributes.groups) Object.assign(group, GROUPS[group.id]);
  for (const tree of blueprint.skills) {
    tree.name = `${SYNTHETIC_DOMAINS[tree.domainId]!.name} tree ${tree.id}`;
    tree.designation = tree.id === 'ai' ? 'FRONTIER' : SYNTHETIC_DOMAINS[tree.domainId]!.designation;
  }
  for (const row of blueprint.reality ?? []) {
    row.label = REALITY_LABELS[row.key] ?? row.label;
    if (row.display) delete row.display.label;
  }
  return blueprint;
}

/** The owner's 40-day log with the synthetic Blueprint activated as version 1 on the arc's first day. */
export function syntheticLog(options: { locks?: boolean } = {}): SystemEvent[] {
  const events = legacyActivityLog({ seed: 42, days: 40 });
  const first = events[0]!;
  const activation = activationEvent(syntheticBlueprint(options), { id: `${first.id}a`, occurred_at: first.occurred_at, local_date: first.local_date });
  return [first, activation, ...events.slice(1)];
}
