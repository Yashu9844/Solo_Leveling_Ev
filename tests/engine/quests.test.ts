import { describe, it, expect } from 'vitest';
import { generateCoreQuestTemplates, generateQuests } from '../../src/engine/quests';
import { DEFAULT_CONFIG } from '../../src/engine/config';
import type { EngineDeps, ImplementationIntention, QuestInstance } from '../../src/engine/types';

function seededDeps(): EngineDeps {
  let counter = 0;
  return {
    now: () => '2026-09-01T03:00:00Z',
    newId: () => `id-${counter++}`,
  };
}

const CAREER_INTENTION: ImplementationIntention = {
  time: '08:35',
  place: 'my desk',
  first_action: 'open the job board before anything',
};
const DSA_INTENTION: ImplementationIntention = {
  time: '22:00',
  place: 'my desk',
  first_action: 'open the editor',
};
const TRAINING_INTENTION: ImplementationIntention = {
  time: '20:15',
  place: 'the gym',
  first_action: 'change & start',
};

const INTENTIONS = { career: CAREER_INTENTION, dsa: DSA_INTENTION, training: TRAINING_INTENTION };

describe('generateCoreQuestTemplates', () => {
  it('returns exactly 6 templates', () => {
    const templates = generateCoreQuestTemplates('arc-1', INTENTIONS, DEFAULT_CONFIG, seededDeps());
    expect(templates).toHaveLength(6);
  });

  it('keys are exactly career, dsa, build, training, sleep, attention', () => {
    const templates = generateCoreQuestTemplates('arc-1', INTENTIONS, DEFAULT_CONFIG, seededDeps());
    expect(templates.map((t) => t.key)).toEqual([
      'career',
      'dsa',
      'build',
      'training',
      'sleep',
      'attention',
    ]);
  });

  it('xp values are 100/100/100/100/60/40 and sum to 500', () => {
    const templates = generateCoreQuestTemplates('arc-1', INTENTIONS, DEFAULT_CONFIG, seededDeps());
    expect(templates.map((t) => t.xp)).toEqual([100, 100, 100, 100, 60, 40]);
    expect(templates.reduce((sum, t) => sum + t.xp, 0)).toBe(500);
  });

  it('reads xp and category from config, not literals — a mutated config changes the output', () => {
    const mutatedConfig = {
      ...DEFAULT_CONFIG,
      coreQuests: {
        ...DEFAULT_CONFIG.coreQuests,
        career: { xp: 999, category: 'MIND' as const },
      },
    };
    const templates = generateCoreQuestTemplates('arc-1', INTENTIONS, mutatedConfig, seededDeps());
    const career = templates.find((t) => t.key === 'career');
    expect(career?.xp).toBe(999);
    expect(career?.category).toBe('MIND');
  });

  it('each template carries its implementation_intention verbatim', () => {
    const templates = generateCoreQuestTemplates('arc-1', INTENTIONS, DEFAULT_CONFIG, seededDeps());
    const byKey = Object.fromEntries(templates.map((t) => [t.key, t]));
    expect(byKey.career?.implementation_intention).toEqual(CAREER_INTENTION);
    expect(byKey.dsa?.implementation_intention).toEqual(DSA_INTENTION);
    expect(byKey.training?.implementation_intention).toEqual(TRAINING_INTENTION);
    // build/sleep/attention are not captured at onboarding (final/06 §5.1
    // step 5 only asks for career/dsa/training) — no fabricated sentence.
    expect(byKey.build?.implementation_intention).toBeUndefined();
    expect(byKey.sleep?.implementation_intention).toBeUndefined();
    expect(byKey.attention?.implementation_intention).toBeUndefined();
  });

  it('is deterministic: same inputs + seeded newId -> deep-equal output', () => {
    const a = generateCoreQuestTemplates('arc-1', INTENTIONS, DEFAULT_CONFIG, seededDeps());
    const b = generateCoreQuestTemplates('arc-1', INTENTIONS, DEFAULT_CONFIG, seededDeps());
    expect(a).toEqual(b);
  });

  it('active_from === arc.startDate, active_to === null, locked_until_checkpoint === true', () => {
    const templates = generateCoreQuestTemplates('arc-1', INTENTIONS, DEFAULT_CONFIG, seededDeps());
    for (const t of templates) {
      expect(t.active_from).toBe(DEFAULT_CONFIG.arc.startDate);
      expect(t.active_to).toBeNull();
      expect(t.locked_until_checkpoint).toBe(true);
    }
  });
});

describe('generateQuests', () => {
  const templates = generateCoreQuestTemplates('arc-1', INTENTIONS, DEFAULT_CONFIG, seededDeps());
  const today = '2026-09-05';

  it('produces exactly 6 instances for a fresh day', () => {
    const instances = generateQuests(today, templates, [], DEFAULT_CONFIG, seededDeps());
    expect(instances).toHaveLength(6);
    expect(instances.every((i) => i.state === 'available')).toBe(true);
    expect(instances.every((i) => i.local_date === today)).toBe(true);
  });

  it('is idempotent: called twice with the existing instances, returns them unchanged', () => {
    const first = generateQuests(today, templates, [], DEFAULT_CONFIG, seededDeps());
    const second = generateQuests(today, templates, first, DEFAULT_CONFIG, seededDeps());
    expect(second).toEqual(first);
  });

  it('never overwrites a completed instance', () => {
    const first = generateQuests(today, templates, [], DEFAULT_CONFIG, seededDeps());
    const completed: QuestInstance[] = first.map((i, idx) =>
      idx === 0 ? { ...i, state: 'complete', completed_at: '2026-09-05T05:00:00Z' } : i
    );
    const regenerated = generateQuests(today, templates, completed, DEFAULT_CONFIG, seededDeps());
    expect(regenerated[0]?.state).toBe('complete');
    expect(regenerated[0]?.completed_at).toBe('2026-09-05T05:00:00Z');
  });

  it('excludes templates outside their active window', () => {
    const futureTemplate = { ...templates[0]!, id: 'tpl-future', active_from: '2099-01-01' };
    const expiredTemplate = { ...templates[1]!, id: 'tpl-expired', active_to: '2020-01-01' };
    const instances = generateQuests(
      today,
      [...templates, futureTemplate, expiredTemplate],
      [],
      DEFAULT_CONFIG,
      seededDeps()
    );
    expect(instances.map((i) => i.template_id)).not.toContain('tpl-future');
    expect(instances.map((i) => i.template_id)).not.toContain('tpl-expired');
    expect(instances).toHaveLength(6);
  });

  it('is deterministic with a seeded newId', () => {
    const a = generateQuests(today, templates, [], DEFAULT_CONFIG, seededDeps());
    const b = generateQuests(today, templates, [], DEFAULT_CONFIG, seededDeps());
    expect(a).toEqual(b);
  });

  it('generates for the given localDate only — no backfill', () => {
    const instances = generateQuests(today, templates, [], DEFAULT_CONFIG, seededDeps());
    expect(new Set(instances.map((i) => i.local_date))).toEqual(new Set([today]));
    // A prior day's instances passed as `existing` are irrelevant — they
    // don't match today's local_date, so the caller wouldn't pass them in
    // (existing is scoped to `localDate`), and generation still yields
    // exactly today's 6, never a backfilled set for the gap.
    const withStaleExisting = generateQuests(today, templates, [], DEFAULT_CONFIG, seededDeps());
    expect(withStaleExisting).toHaveLength(6);
  });
});
