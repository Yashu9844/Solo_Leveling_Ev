// Shared by tests/engine/fuzz.test.ts and tests/engine/golden-120.test.ts
// — one generator, two uses: a random day count for fuzzing arbitrary
// churn, or a fixed 120-day count for the golden fixture's frozen
// snapshot. Not a *.test.ts file, so vitest's include glob skips it.
import { addDays, format, parseISO } from 'date-fns';
import { DEFAULT_CONFIG } from '../../../src/engine/config';
import type {
  CoreQuestKey,
  EngineDeps,
  MaintenanceLoggedPayload,
  QuestCompletedPayload,
  QuestRecoveredPayload,
  QuestUndonePayload,
  StepsLoggedPayload,
  SystemEvent,
} from '../../../src/engine/types';

export const CORE_KEYS: CoreQuestKey[] = ['career', 'dsa', 'build', 'training', 'sleep', 'attention'];
export const ARC_ID = 'fuzz-arc';
export const START_DATE = DEFAULT_CONFIG.arc.startDate;

// mulberry32 — small, dependency-free, seedable. Reproducible: a failing
// seed (or the golden fixture's fixed seed) can be pinned and replayed
// exactly.
export function mulberry32(seed: number) {
  let a = seed;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const fuzzDeps: EngineDeps = { now: () => '2026-09-01T04:30:00Z', newId: () => 'fuzz-id' };

export function localDateAt(offsetDays: number): string {
  return format(addDays(parseISO(START_DATE), offsetDays), 'yyyy-MM-dd');
}

/**
 * Builds one random-but-structurally-valid event log: ARC_STARTED, then
 * `dayCount` days (random 1-40 if omitted, exact if given — the golden
 * fixture passes 120) each opened (APP_OPENED) with a random walk of
 * QUEST_COMPLETED/QUEST_UNDONE per core key, plus a random sprinkling of
 * every other XP-bearing event type. "Valid" means well-typed and
 * idem_key-unique, not gameplay-realistic — the point is to stress
 * arithmetic edge cases a hand-written test wouldn't think to try, not
 * to model a plausible day.
 */
export function randomEventLog(seed: number, dayCount?: number): SystemEvent[] {
  const rand = mulberry32(seed);
  const events: SystemEvent[] = [];
  let counter = 0;
  const nextId = () => `evt-${seed}-${counter++}`;

  events.push({
    id: nextId(),
    type: 'ARC_STARTED',
    occurred_at: `${START_DATE}T04:30:00Z`,
    local_date: START_DATE,
    arc_id: ARC_ID,
    payload: {
      arcId: ARC_ID,
      startDate: START_DATE,
      endDate: DEFAULT_CONFIG.arc.endDate,
      timezone: DEFAULT_CONFIG.arc.timezone,
      dayBoundaryHour: DEFAULT_CONFIG.arc.dayBoundaryHour,
      dayCloseHour: DEFAULT_CONFIG.arc.dayCloseHour,
      mainQuestText: 'Fuzz.',
    },
    source: 'user',
    idem_key: `arc-started:${ARC_ID}`,
    schema_v: 1,
  });

  const days = dayCount ?? 1 + Math.floor(rand() * 40);
  let bossesCleared = 0;

  for (let d = 0; d < days; d++) {
    const localDate = localDateAt(d);
    const occurredAt = `${localDate}T10:00:00Z`;

    events.push({
      id: nextId(),
      type: 'APP_OPENED',
      occurred_at: occurredAt,
      local_date: localDate,
      arc_id: ARC_ID,
      payload: { seconds: 0 },
      source: 'system',
      idem_key: `app-opened:${localDate}`,
      schema_v: 1,
    });

    for (const key of CORE_KEYS) {
      if (rand() < 0.3) continue; // this key untouched today
      // Matches engine/quests.ts's real derived-id scheme exactly
      // (`${arcId}::${key}` for the template, `${templateId}::${localDate}`
      // for the instance) so buildProjections' instance-decoration step
      // (db/projections.ts's `instances.map` matching `state.quests` by
      // id) actually finds these completions — a mismatched synthetic id
      // would silently leave every instance stuck at 'available' while
      // still (correctly) crediting XP, since the ledger reads
      // state.quests directly. Caught by inspecting this generator's own
      // first golden-fixture snapshot, where completedInstanceCount was
      // 0 despite a nonzero ledger.
      const templateId = `${ARC_ID}::${key}`;
      const instanceId = `${templateId}::${localDate}`;
      const toggles = Math.floor(rand() * 4); // 0-3 complete/undo pairs
      for (let t = 0; t < toggles; t++) {
        const completing = t % 2 === 0;
        if (completing) {
          events.push({
            id: nextId(),
            type: 'QUEST_COMPLETED',
            occurred_at: occurredAt,
            local_date: localDate,
            arc_id: ARC_ID,
            payload: {
              instanceId,
              templateId,
              questKey: key,
              localDate,
            } satisfies QuestCompletedPayload,
            source: 'user',
            idem_key: nextId(),
            schema_v: 1,
          });
        } else {
          events.push({
            id: nextId(),
            type: 'QUEST_UNDONE',
            occurred_at: occurredAt,
            local_date: localDate,
            arc_id: ARC_ID,
            payload: { instanceId, localDate } satisfies QuestUndonePayload,
            source: 'user',
            idem_key: nextId(),
            schema_v: 1,
          });
        }
      }
    }

    if (rand() < 0.15) {
      events.push({
        id: nextId(),
        type: 'QUEST_RECOVERED',
        occurred_at: occurredAt,
        local_date: localDate,
        arc_id: ARC_ID,
        payload: { localDate: localDateAt(Math.max(0, d - 1)) } satisfies QuestRecoveredPayload,
        source: 'user',
        idem_key: `recovery:${localDate}`,
        schema_v: 1,
      });
    }

    if (rand() < 0.2) {
      events.push({
        id: nextId(),
        type: 'PROBLEM_REVISITED',
        occurred_at: occurredAt,
        local_date: localDate,
        arc_id: ARC_ID,
        payload: { problemId: `p-${d}`, outcome: 'first_attempt', minutes: 10 },
        source: 'user',
        idem_key: nextId(),
        schema_v: 1,
      });
    }

    if (rand() < 0.1) {
      events.push({
        id: nextId(),
        type: 'ARTIFACT_SHIPPED',
        occurred_at: occurredAt,
        local_date: localDate,
        arc_id: ARC_ID,
        payload: { artifactId: nextId(), kind: 'feature', title: 'fuzz', projectKey: 'fuzz' },
        source: 'user',
        idem_key: nextId(),
        schema_v: 1,
      });
    }

    if (rand() < 0.2) {
      events.push({
        id: nextId(),
        type: 'STEPS_LOGGED',
        occurred_at: occurredAt,
        local_date: localDate,
        arc_id: ARC_ID,
        payload: { localDate, steps: Math.floor(rand() * 20000) } satisfies StepsLoggedPayload,
        source: 'user',
        idem_key: `steps:${localDate}`,
        schema_v: 1,
      });
    }

    if (rand() < 0.2) {
      events.push({
        id: nextId(),
        type: 'MAINTENANCE_LOGGED',
        occurred_at: occurredAt,
        local_date: localDate,
        arc_id: ARC_ID,
        payload: {
          localDate,
          bath: rand() < 0.5,
          fuel: rand() < 0.5,
          laundry: rand() < 0.5,
          allDone: rand() < 0.5,
        } satisfies MaintenanceLoggedPayload,
        source: 'user',
        idem_key: `maintenance:${localDate}`,
        schema_v: 1,
      });
    }

    if (bossesCleared < 4 && rand() < 0.05) {
      bossesCleared += 1;
      events.push({
        id: nextId(),
        type: 'BOSS_CLEARED',
        occurred_at: occurredAt,
        local_date: localDate,
        arc_id: ARC_ID,
        payload: { bossId: ['I', 'II', 'III', 'IV'][bossesCleared - 1] },
        source: 'user',
        idem_key: `boss:${bossesCleared}`,
        schema_v: 1,
      });
    }

    if (rand() < 0.1) {
      events.push({
        id: nextId(),
        type: 'WEEKLY_QUEST_COMPLETED',
        occurred_at: occurredAt,
        local_date: localDate,
        arc_id: ARC_ID,
        payload: { weeklyQuestId: nextId() },
        source: 'user',
        idem_key: nextId(),
        schema_v: 1,
      });
    }

    if (d % 7 === 6) {
      events.push({
        id: nextId(),
        type: 'WEEK_REVIEWED',
        occurred_at: occurredAt,
        local_date: localDate,
        arc_id: ARC_ID,
        payload: { weekStartDate: localDateAt(d - 6), weekEndDate: localDate },
        source: 'user',
        idem_key: `week-reviewed:${localDateAt(d - 6)}`,
        schema_v: 1,
      });
    }
  }

  return events;
}
