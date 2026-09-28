import { addDays, format, parseISO } from 'date-fns';
import type {
  ArcPausedPayload,
  ArcResumedPayload,
  ArcStartedPayload,
  EngineConfig,
  EngineState,
  MetricRecordedPayload,
  PlanAmendedPayload,
  QuestCompletedPayload,
  QuestRecoveredPayload,
  QuestUndonePayload,
  ReviewCompletedPayload,
  SystemEvent,
} from './types';

function shiftDate(dateStr: string, days: number): string {
  return format(addDays(parseISO(dateStr), days), 'yyyy-MM-dd');
}

/**
 * Pure. Replays the event log into the full derived state. Deterministic:
 * applyEvents(log) twice yields identical state, and a duplicate idem_key
 * in the log is a no-op (tracked and skipped during the fold, mirroring
 * the db-level idem_key uniqueness guarantee in db/events.ts).
 *
 * The empty-log case returning the empty base state is specified
 * behaviour (final/08 Slice 0 acceptance criteria), not a compromise —
 * it is simply what folding zero events over the identity state produces.
 *
 * Every unhandled event type still throws — deliberately no permissive
 * default case, so an unhandled event type fails loudly for the rest of
 * the build rather than being silently dropped.
 * TODO: Slice 3 (XP-bearing events) and beyond — each slice adds its
 * event types here.
 */
export function applyEvents(events: SystemEvent[], config: EngineConfig): EngineState {
  // Not read by any branch yet — no event handled so far needs a cap,
  // a category, or a day boundary. Kept in the public signature because
  // Slice 3's XP-bearing events will need it immediately.
  void config;

  let state = emptyEngineState();
  const seenIdemKeys = new Set<string>();

  for (const event of events) {
    if (seenIdemKeys.has(event.idem_key)) {
      continue;
    }
    seenIdemKeys.add(event.idem_key);
    state = applyOne(state, event);
  }

  return state;
}

function applyOne(state: EngineState, event: SystemEvent): EngineState {
  switch (event.type) {
    case 'ARC_STARTED': {
      const payload = event.payload as unknown as ArcStartedPayload;
      return {
        ...state,
        arc: {
          id: payload.arcId,
          start_date: payload.startDate,
          end_date: payload.endDate,
          timezone: payload.timezone,
          day_boundary_hour: payload.dayBoundaryHour,
          day_close_hour: payload.dayCloseHour,
          main_quest_text: payload.mainQuestText,
          stake_text: payload.stakeText,
          status: 'active',
          paused_dates: [],
        },
      };
    }

    case 'ARC_PAUSED': {
      // Commits to a duration upfront (final/01 §6.5) — end_date shifts
      // forward by the full planned length immediately; an early
      // ARC_RESUMED doesn't claw that shift back (see its case below).
      if (!state.arc) return state;
      const payload = event.payload as unknown as ArcPausedPayload;
      const newlyPaused: string[] = [];
      for (let i = 0; i < payload.days; i++) {
        newlyPaused.push(shiftDate(payload.localDate, i));
      }
      const pausedDates = Array.from(new Set([...state.arc.paused_dates, ...newlyPaused])).sort();
      return {
        ...state,
        arc: {
          ...state.arc,
          status: 'paused',
          end_date: shiftDate(state.arc.end_date, payload.days),
          paused_dates: pausedDates,
        },
      };
    }

    case 'ARC_RESUMED': {
      // Days before this event's local_date stay paused in history — a
      // day that really was paused never retroactively becomes a miss.
      // Days from local_date onward are un-paused (early resume).
      if (!state.arc) return state;
      const payload = event.payload as unknown as ArcResumedPayload;
      const pausedDates = state.arc.paused_dates.filter((d) => d < payload.localDate);
      return { ...state, arc: { ...state.arc, status: 'active', paused_dates: pausedDates } };
    }

    case 'PLAN_AMENDED': {
      // There is no template object in EngineState to "attach" this to
      // (templates aren't event-sourced — see QuestCompletionRecord's
      // doc comment in types.ts) — so the latest intention per quest key
      // is tracked directly. A later PLAN_AMENDED for the same key
      // replaces the earlier one, which is the "amend" in its name.
      const payload = event.payload as unknown as PlanAmendedPayload;
      return {
        ...state,
        intentions: { ...state.intentions, [payload.questKey]: payload.implementationIntention },
      };
    }

    case 'METRIC_RECORDED': {
      const payload = event.payload as unknown as MetricRecordedPayload;
      return {
        ...state,
        baselineMetrics: { ...state.baselineMetrics, [payload.kind]: payload.value },
      };
    }

    case 'QUEST_COMPLETED': {
      const payload = event.payload as unknown as QuestCompletedPayload;
      return {
        ...state,
        quests: {
          ...state.quests,
          [payload.instanceId]: {
            instance_id: payload.instanceId,
            template_id: payload.templateId,
            quest_key: payload.questKey,
            local_date: payload.localDate,
            completed_at: event.occurred_at,
            event_id: event.id,
          },
        },
      };
    }

    case 'QUEST_UNDONE': {
      // Undone means "no completion overlay," i.e. back to available —
      // so this deletes the entry rather than recording an "undone" state.
      const payload = event.payload as unknown as QuestUndonePayload;
      const quests = Object.fromEntries(
        Object.entries(state.quests).filter(([instanceId]) => instanceId !== payload.instanceId)
      );
      return { ...state, quests };
    }

    case 'QUEST_RECOVERED': {
      const payload = event.payload as unknown as QuestRecoveredPayload;
      return { ...state, recoveries: { ...state.recoveries, [payload.localDate]: true } };
    }

    case 'REVIEW_COMPLETED': {
      const payload = event.payload as unknown as ReviewCompletedPayload;
      return { ...state, reviews: { ...state.reviews, [payload.localDate]: payload } };
    }

    case 'APP_OPENED':
      // "Was this day opened" is read directly off the raw event log by
      // db/projections.ts (the set of local_dates with an APP_OPENED
      // event) — EngineState has nothing to fold it into. This is an
      // explicit no-op case, not a silent default: APP_OPENED is
      // deliberately handled and deliberately inert here.
      return state;

    // Slice 6 — final/02-career-system.md. Applications, substitute
    // work, career events (external outcomes AND the controlled
    // conversation/mock/followup kinds), resume versions and follow-ups
    // are all persisted directly to their own db tables (application,
    // career_event, resume_version) at write time — the same "write
    // event + write projection" pattern as onboarding's arc/quest_template
    // rows. None of the five feed anything a rebuild needs to reconstruct
    // (unlike quest completions, which route through XP and the streak),
    // so EngineState has nothing to fold them into. Explicit no-op cases,
    // not a silent default — each is deliberately handled and inert here.
    case 'APPLICATION_LOGGED':
    case 'CAREER_SUBSTITUTE_LOGGED':
    case 'CAREER_EVENT_LOGGED':
    case 'RESUME_VERSION_CREATED':
    case 'FOLLOWUP_LOGGED':
      return state;

    // Slice 7 — final/03-learning-systems.md §2. DSA problems and
    // revisits persist to their own tables (dsa_problem, dsa_attempt) at
    // write time, same pattern as the career events above.
    // PROBLEM_REVISITED grants XP (engine/xp.ts's computeXp reads the
    // raw event directly, independent of this fold) but still needs no
    // EngineState fold of its own — same reasoning as QUEST_RECOVERED.
    case 'PROBLEM_LOGGED':
    case 'PROBLEM_REVISITED':
      return state;

    // Slice 8 — final/03-learning-systems.md §3-4. Learning blocks,
    // system design study and BUILD sessions persist to their own
    // tables (learning_block, system_design_study, build_session).
    // ARTIFACT_SHIPPED grants XP the same way PROBLEM_REVISITED does —
    // engine/xp.ts reads the raw event, no EngineState fold needed.
    case 'LEARNING_BLOCK_LOGGED':
    case 'SYSTEM_DESIGN_LOGGED':
    case 'BUILD_SESSION_LOGGED':
    case 'ARTIFACT_SHIPPED':
      return state;

    // Slice 9 — final/04-physical-lifestyle.md. Training sessions, steps,
    // sleep, screen time and the maintenance tick all persist to their own
    // tables (training_session, metric_sample, maintenance_log) at write
    // time, same pattern as career/DSA/BUILD above. STEPS_LOGGED and
    // MAINTENANCE_LOGGED grant XP (engine/xp.ts reads the raw event
    // directly) but still need no EngineState fold — same reasoning as
    // QUEST_RECOVERED. METRIC_RECORDED (body weight/waist/bodyfat) is
    // handled separately above and never grants XP — final/04 §1.
    case 'TRAINING_SESSION_LOGGED':
    case 'STEPS_LOGGED':
    case 'SLEEP_LOGGED':
    case 'SCREENTIME_LOGGED':
    case 'MAINTENANCE_LOGGED':
      return state;

    // Slice 13 — final/01 §7. BOSS_CLEARED grants XP the same way
    // QUEST_RECOVERED does (engine/xp.ts reads the raw event directly);
    // "cleared or not" for a given boss is read live off the raw event
    // log by store/boss.ts, not folded into EngineState. Explicit no-op,
    // not a silent default.
    case 'BOSS_CLEARED':
      return state;

    // Slice 14 — WEEK_REVIEWED was declared in the original catalogue
    // (final/07 §4.1) but never given a payload or a fold; it's an
    // audit record only (ui/review/WeeklyReview.tsx's Accept action),
    // same shape as REVIEW_COMPLETED's daily counterpart except nothing
    // reads it back for display, so nothing needs to be folded.
    // WEEKLY_QUEST_COMPLETED grants XP the same way BOSS_CLEARED does
    // (engine/xp.ts reads the event directly); "which weekly quest is
    // active / its live progress" is read live by store/weeklyQuest.ts
    // from the direct-write weekly_quest table, not folded here.
    case 'WEEK_REVIEWED':
    case 'WEEKLY_QUEST_COMPLETED':
      return state;

    default:
      throw new Error(`Not implemented — Slice N (unhandled event type: ${event.type})`);
  }
}

function emptyEngineState(): EngineState {
  return {
    player: {
      total_xp: 0,
      level: 1,
      xp_into_level: 0,
      xp_for_next: 0, // placeholder until level.ts (Slice 3) computes req(1)
      rank: 'E',
      rank_since_day: 0,
      arc_streak: 0,
      consistency_7: 0,
      consistency_28: 0,
      grace_remaining: 0,
      schema_v: 1,
    },
    days: {},
    quests: {},
    intentions: {},
    baselineMetrics: {},
    recoveries: {},
    reviews: {},
    arc: null,
  };
}
