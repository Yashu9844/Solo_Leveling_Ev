import type {
  CoreQuestKey,
  EngineConfig,
  EngineDeps,
  ImplementationIntention,
  QuestInstance,
  QuestTemplate,
} from './types';

// Fixed generation order — determinism (same inputs -> identical output,
// including ids drawn from deps.newId in this exact sequence) depends on
// iterating the six keys in a stable order, not object key enumeration.
const CORE_QUEST_KEYS: readonly CoreQuestKey[] = [
  'career',
  'dsa',
  'build',
  'training',
  'sleep',
  'attention',
];

const CORE_QUEST_TITLES: Record<CoreQuestKey, string> = {
  career: 'ASCENSION',
  dsa: 'LOGIC TRIAL',
  build: 'FORGE',
  training: 'VITALITY TRIAL',
  sleep: 'RECONSTITUTION',
  attention: 'WILL TRIAL',
};

// final/10-SLICE-1-PROMPT.md Step 1.2's criterion table, verbatim.
const CORE_QUEST_CRITERIA: Record<CoreQuestKey, Record<string, unknown>> = {
  career: { kind: 'applications_or_substitute', applications: 3, substituteMinutes: 25 },
  dsa: { kind: 'problems_or_minutes', problems: 1, minutes: 25 },
  build: { kind: 'minutes_with_mode', minutes: 45, modes: ['LEARN', 'SHIP'] },
  training: { kind: 'session_or_steps', steps: 8000 },
  sleep: { kind: 'wake_window', toleranceMinutes: 30 },
  attention: { kind: 'screen_time_under', minutes: 60 },
};

/**
 * Pure. Produces the six core quest templates for a new arc. XP and
 * category are always read from config.coreQuests, never hard-coded.
 * Deterministic: identical arcId/intentions/config produce a deep-equal
 * result, including ids — `id = "${arcId}::${key}"`, a plain composite
 * key rather than deps.newId(). This is a Slice 3 change (was
 * deps.newId() in Slice 1): rebuildProjections must reproduce the exact
 * same template ids on every rebuild, and a fresh random id can't do
 * that. See the Slice 3 report for the full reasoning. `deps` is no
 * longer read here but stays in the signature — kept symmetric with
 * generateQuests, and reserved for anything a later slice's template
 * generation might need to inject.
 */
export function generateCoreQuestTemplates(
  arcId: string,
  intentions: Partial<Record<CoreQuestKey, ImplementationIntention>>,
  config: EngineConfig,
  deps: EngineDeps
): QuestTemplate[] {
  void deps;
  return CORE_QUEST_KEYS.map((key) => {
    const { xp, category } = config.coreQuests[key];
    return {
      id: `${arcId}::${key}`,
      arc_id: arcId,
      type: 'core',
      key,
      title: CORE_QUEST_TITLES[key],
      category,
      xp,
      criterion: CORE_QUEST_CRITERIA[key],
      implementation_intention: intentions[key],
      active_from: config.arc.startDate,
      active_to: null,
      locked_until_checkpoint: true,
    };
  });
}

/**
 * Pure. Produces the day's quest instances from the active core templates.
 * Deterministic: identical inputs produce a deep-equal result, including
 * ids — `id = "${templateId}::${localDate}"`, not deps.newId() (same
 * Slice 3 change and reasoning as generateCoreQuestTemplates: rebuild
 * must reproduce the exact instance ids that QUEST_COMPLETED/UNDONE
 * events already reference by id, live-path and rebuild-path alike).
 *
 * Idempotent: `existing` is assumed already scoped to `localDate` by the
 * caller (see store/quests.ts) — any template with a matching instance in
 * `existing` returns that instance UNCHANGED, so a mid-day refresh can
 * never regenerate over (and silently reset) a completed quest. Only
 * missing templates get a fresh 'available' instance.
 *
 * Generates for `localDate` only — no backfill of past days. A day with
 * no instances is a day that was never opened, a distinction Slice 4's
 * streak logic depends on.
 */
export function generateQuests(
  localDate: string,
  templates: QuestTemplate[],
  existing: QuestInstance[],
  config: EngineConfig,
  deps: EngineDeps
): QuestInstance[] {
  // Not read this slice — core-only generation needs nothing from config,
  // and ids are now derived, not drawn from deps.newId(). Kept in the
  // signature for weekly/revisit/adaptive generation in later slices.
  void config;
  void deps;

  const existingByTemplateId = new Map(existing.map((instance) => [instance.template_id, instance]));

  const activeCoreTemplates = templates.filter(
    (t) =>
      t.type === 'core' &&
      t.active_from <= localDate &&
      (t.active_to === null || localDate < t.active_to)
  );

  return activeCoreTemplates.map((template) => {
    const found = existingByTemplateId.get(template.id);
    if (found) {
      return found;
    }
    return {
      id: `${template.id}::${localDate}`,
      template_id: template.id,
      local_date: localDate,
      state: 'available',
      progress: {},
      recovered: false,
    };
  });
}
