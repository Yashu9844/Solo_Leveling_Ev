// final/03-learning-systems.md §3-4. Logging a BUILD session (LEARN or
// SHIP, 45+ minutes total today) auto-completes the BUILD core quest,
// same pattern as career/DSA. Learning blocks and system design study
// grant LEARN XP directly on logging (final/03 §3: "not a seventh core
// quest") rather than through quest completion.
import type {
  ArtifactShippedPayload,
  BuildSessionLoggedPayload,
  EngineConfig,
  EngineDeps,
  LearningBlockLoggedPayload,
  SystemDesignLoggedPayload,
} from '../engine/types';
import { db } from '../db/db';
import { appendEvent } from '../db/events';
import { completeQuest } from './quests';
import { rebuildProjections } from '../db/projections';
import type { ArtifactRow, BuildSessionRow, LearningBlockRow, SystemDesignStudyRow } from '../db/schema';

const REBUILD_ADJACENT_TABLES = [
  db.event,
  db.arc,
  db.quest_template,
  db.quest_instance,
  db.xp_ledger,
  db.day_rollup,
  db.player_state,
  db.build_session,
  db.artifact,
  db.learning_block,
  db.system_design_study,
];

async function maybeCompleteBuildQuest(today: string, arcId: string, config: EngineConfig, deps: EngineDeps): Promise<void> {
  const templates = await db.quest_template.toArray();
  const buildTemplate = templates.find((t) => t.key === 'build' && t.type === 'core');
  if (!buildTemplate) return;

  const instance = (await db.quest_instance.where('local_date').equals(today).toArray()).find(
    (i) => i.template_id === buildTemplate.id
  );
  if (!instance || instance.state === 'complete') return;

  const sessionsToday = await db.build_session.where('local_date').equals(today).toArray();
  const minutesToday = sessionsToday.reduce((sum, s) => sum + s.minutes, 0);

  if (minutesToday >= 45) {
    await completeQuest(instance, 'build', arcId, config, deps);
  }
}

export interface LogBuildSessionInput {
  mode: 'LEARN' | 'SHIP';
  minutes: number;
  projectKey: string;
  note?: string;
  /** SHIP mode only — presence of this means a unit was actually shipped
   * this session, granting the +50 CRAFT bonus (final/03 §4.1). A SHIP
   * session can be logged without one (e.g. shipped work with nothing
   * new to name as an artifact yet). */
  shippedArtifact?: { kind: ArtifactRow['kind']; title: string; url?: string; costPerTaskStated?: boolean };
}

export async function logBuildSession(
  today: string,
  arcId: string,
  input: LogBuildSessionInput,
  config: EngineConfig,
  deps: EngineDeps
): Promise<void> {
  await db.transaction('rw', REBUILD_ADJACENT_TABLES, async () => {
    const sessionId = deps.newId();
    await appendEvent({
      id: sessionId,
      type: 'BUILD_SESSION_LOGGED',
      occurred_at: deps.now(),
      local_date: today,
      arc_id: arcId,
      payload: {
        mode: input.mode,
        minutes: input.minutes,
        projectKey: input.projectKey,
        note: input.note,
      } satisfies BuildSessionLoggedPayload,
      source: 'user',
      idem_key: `build-session:${sessionId}`,
      schema_v: 1,
    });
    const sessionRow: BuildSessionRow = {
      id: sessionId,
      local_date: today,
      mode: input.mode,
      minutes: input.minutes,
      project_key: input.projectKey,
      note: input.note,
    };
    await db.build_session.add(sessionRow);

    if (input.mode === 'SHIP' && input.shippedArtifact) {
      const artifactId = deps.newId();
      await appendEvent({
        id: deps.newId(),
        type: 'ARTIFACT_SHIPPED',
        occurred_at: deps.now(),
        local_date: today,
        arc_id: arcId,
        payload: {
          artifactId,
          ...input.shippedArtifact,
          projectKey: input.projectKey,
        } satisfies ArtifactShippedPayload,
        source: 'user',
        idem_key: `artifact:${artifactId}`,
        schema_v: 1,
      });
      const artifactRow: ArtifactRow = {
        id: artifactId,
        kind: input.shippedArtifact.kind,
        title: input.shippedArtifact.title,
        url: input.shippedArtifact.url,
        project_key: input.projectKey,
        local_date: today,
        cost_per_task_stated: input.shippedArtifact.costPerTaskStated,
      };
      await db.artifact.add(artifactRow);
    }
  });

  await maybeCompleteBuildQuest(today, arcId, config, deps);
  if (input.mode === 'SHIP' && input.shippedArtifact) {
    // The artifact's XP grant needs a rebuild too; maybeCompleteBuildQuest
    // already triggers one via completeQuest when it fires, but that's
    // conditional — do it unconditionally here so the ship bonus always
    // lands even on a day the quest was already complete.
    await rebuildProjections(config, deps);
  }
}

export async function logLearningBlock(
  today: string,
  arcId: string,
  topic: string,
  minutes: number,
  config: EngineConfig,
  deps: EngineDeps,
  note?: string
): Promise<void> {
  const id = deps.newId();
  await db.transaction('rw', REBUILD_ADJACENT_TABLES, async () => {
    await appendEvent({
      id,
      type: 'LEARNING_BLOCK_LOGGED',
      occurred_at: deps.now(),
      local_date: today,
      arc_id: arcId,
      payload: { topic, minutes, note } satisfies LearningBlockLoggedPayload,
      source: 'user',
      idem_key: `learning-block:${id}`,
      schema_v: 1,
    });
    const row: LearningBlockRow = { id, local_date: today, topic, minutes, note };
    await db.learning_block.add(row);
  });
  await rebuildProjections(config, deps);
}

export async function logSystemDesignStudy(
  today: string,
  arcId: string,
  system: string,
  mode: SystemDesignStudyRow['mode'],
  minutes: number,
  config: EngineConfig,
  deps: EngineDeps,
  artifactUrl?: string,
  notes?: string
): Promise<void> {
  const id = deps.newId();
  await db.transaction('rw', REBUILD_ADJACENT_TABLES, async () => {
    await appendEvent({
      id,
      type: 'SYSTEM_DESIGN_LOGGED',
      occurred_at: deps.now(),
      local_date: today,
      arc_id: arcId,
      payload: { system, mode, minutes, artifactUrl, notes } satisfies SystemDesignLoggedPayload,
      source: 'user',
      idem_key: `system-design:${id}`,
      schema_v: 1,
    });
    const row: SystemDesignStudyRow = { id, local_date: today, system, mode, minutes, artifact_url: artifactUrl, notes };
    await db.system_design_study.add(row);
  });
  await rebuildProjections(config, deps);
}

export async function getTodayBuildMinutes(today: string): Promise<number> {
  const sessions = await db.build_session.where('local_date').equals(today).toArray();
  return sessions.reduce((sum, s) => sum + s.minutes, 0);
}

export async function getTodayLearnBlockCount(today: string): Promise<number> {
  const [blocks, designs] = await Promise.all([
    db.learning_block.where('local_date').equals(today).count(),
    db.system_design_study.where('local_date').equals(today).count(),
  ]);
  return blocks + designs;
}
