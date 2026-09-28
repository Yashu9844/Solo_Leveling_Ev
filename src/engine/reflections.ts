// final/05-motivation-moments-notifications.md §1.2 — the reflection
// library. "Investment follows value: build the generator properly,
// keep the library small" — this is deliberately a smaller, carefully-
// written set (64 lines across all 12 categories) rather than a
// mechanically-padded 150; every line here respects the doc's hard bans
// and is, per the spec's own words, "subject to your review before
// ship" — a real starting set, not final copy. Selection prefers a
// System Message (engine/messages.ts's P1-P3) over any reflection
// whenever one is available; this library is the fallback texture, not
// the primary content.
export type ReflectionCategory =
  | 'discipline'
  | 'focus'
  | 'career'
  | 'setbacks'
  | 'consistency'
  | 'self_efficacy'
  | 'training'
  | 'study'
  | 'procrastination'
  | 'courage'
  | 'identity'
  | 'long_horizon';

// Cut from the brief's 8 tones: aggressive ("at 08:30 on a bad day it's
// the mechanism that turns this into a shame machine") and urgent
// ("nothing in a 120-day arc is urgent today"). Encouraging folds into
// calm.
export type ReflectionTone = 'direct' | 'calm' | 'challenging' | 'reflective' | 'celebratory';

export type ReflectionContext =
  | 'MORNING'
  | 'PRE_DEEP'
  | 'POST_COMPLETE'
  | 'POST_LAPSE'
  | 'EVENING'
  | 'LEVEL_UP'
  | 'BOSS'
  | 'CHECKPOINT';

export interface Reflection {
  id: string;
  text: string;
  category: ReflectionCategory;
  tone: ReflectionTone;
  context: ReflectionContext[];
  min_day: number;
  max_day: number;
  cooldown_days: number;
  /** "Your taste, honestly labelled" (final/05 §1.2) — no `effectiveness`
   * field exists or ever will; this is a static authoring preference,
   * not a measured score. Left at the neutral default (1) for every
   * line in this first pass — there is no basis yet to weight one
   * original line over another. */
  weight: number;
}

const DEFAULT_COOLDOWN = 21;
const DEFAULT_WEIGHT = 1;
const ALL_DAYS = { min_day: 1, max_day: 120 };

function r(
  id: string,
  text: string,
  category: ReflectionCategory,
  tone: ReflectionTone,
  context: ReflectionContext[],
  overrides: Partial<Pick<Reflection, 'min_day' | 'max_day' | 'cooldown_days' | 'weight'>> = {}
): Reflection {
  return { id, text, category, tone, context, cooldown_days: DEFAULT_COOLDOWN, weight: DEFAULT_WEIGHT, ...ALL_DAYS, ...overrides };
}

/**
 * The library. No `author`/`source`/`copyright_status` (everything
 * original) and no `effectiveness` field (final/05 §1.2: "you can't
 * measure it without an experiment you'll never run, and a fake score
 * is worse than none"). `times_shown`/`last_shown_at` live in
 * db.reflection_state, not here — this array is static content.
 */
export const REFLECTIONS: Reflection[] = [
  // discipline
  r('discipline-1', 'The decision was made last night. This morning is execution.', 'discipline', 'calm', ['MORNING']),
  r('discipline-2', "Motivation is unreliable by design. The plan doesn't need it to work.", 'discipline', 'direct', ['MORNING']),
  r('discipline-3', "You don't have to want to. You just have to start.", 'discipline', 'direct', ['PRE_DEEP', 'MORNING']),
  r('discipline-4', 'Discipline is just doing the thing you already decided, without re-deciding.', 'discipline', 'reflective', ['MORNING', 'EVENING']),
  r('discipline-5', "The version of you from a week ago set this up so today's version wouldn't have to think.", 'discipline', 'calm', ['MORNING']),

  // focus
  r('focus-1', 'Forty-five minutes. You can stop after that and it still counts.', 'focus', 'calm', ['PRE_DEEP']),
  r('focus-2', 'One thing, unglamorously, for a while.', 'focus', 'direct', ['PRE_DEEP']),
  r('focus-3', 'Close the other seventeen tabs. This one is the only one that matters right now.', 'focus', 'direct', ['PRE_DEEP']),
  r('focus-4', 'Depth beats duration. Twenty real minutes outweighs two distracted hours.', 'focus', 'reflective', ['PRE_DEEP']),
  r('focus-5', "The work in front of you doesn't need your full life. It needs the next block.", 'focus', 'calm', ['PRE_DEEP']),

  // career
  r('career-1', "The applications are controllable. The replies aren't. Keep the first, stop scoring yourself on the second.", 'career', 'calm', ['EVENING', 'POST_COMPLETE']),
  r('career-2', 'A quiet inbox is data about the market, not a verdict on you.', 'career', 'reflective', ['EVENING']),
  r('career-3', 'Every application is a rep. The reps compound whether or not any single one lands.', 'career', 'direct', ['POST_COMPLETE']),
  r('career-4', "You can't control who responds. You can control whether the next one is better than the last.", 'career', 'calm', ['EVENING']),
  r('career-5', 'The résumé gets better one honest edit at a time, not one rewrite.', 'career', 'reflective', ['MORNING']),

  // setbacks — post-lapse only ever pulls from here, and only calm/reflective
  r('setbacks-1', "Yesterday is data, not a verdict. What's the first ten minutes today?", 'setbacks', 'calm', ['POST_LAPSE']),
  r('setbacks-2', "A missed day doesn't erase the ones before it.", 'setbacks', 'calm', ['POST_LAPSE']),
  r('setbacks-3', 'The plan accounted for days like yesterday. This is the part where it works.', 'setbacks', 'reflective', ['POST_LAPSE']),
  r('setbacks-4', 'Nothing about today is owed to yesterday.', 'setbacks', 'calm', ['POST_LAPSE']),
  r('setbacks-5', 'One day off the plan is a data point. It only becomes a pattern if you decide it is.', 'setbacks', 'reflective', ['POST_LAPSE']),

  // consistency
  r('consistency-1', "Four of six is a day that happened, and it counts.", 'consistency', 'calm', ['EVENING']),
  r('consistency-2', "Fourth time this week you did it when you didn't want to.", 'consistency', 'celebratory', ['POST_COMPLETE']),
  r('consistency-3', 'Fourteen days is enough to notice a pattern. Not enough to call it permanent.', 'consistency', 'reflective', ['EVENING']),
  r('consistency-4', 'The days add up whether or not any single one felt significant.', 'consistency', 'calm', ['EVENING']),
  r('consistency-5', "You don't need a streak. You need enough of the days, most of the time.", 'consistency', 'calm', ['MORNING']),

  // self_efficacy
  r('self-efficacy-1', 'You did the hard version last time. This is the easy version of that.', 'self_efficacy', 'direct', ['PRE_DEEP']),
  r('self-efficacy-2', 'The skill was built in smaller pieces than this looks like from here.', 'self_efficacy', 'reflective', ['MORNING']),
  r('self-efficacy-3', "You've solved harder problems than this one, on worse days than this one.", 'self_efficacy', 'direct', ['PRE_DEEP']),
  r('self-efficacy-4', "Competence is quieter than confidence. You have more of the first than you're giving yourself credit for.", 'self_efficacy', 'reflective', ['EVENING']),
  r('self-efficacy-5', 'The evidence is in the log, not in how today feels.', 'self_efficacy', 'calm', ['EVENING', 'CHECKPOINT']),

  // training
  r('training-1', "The weight doesn't care how you feel about it. Move it anyway.", 'training', 'direct', ['PRE_DEEP']),
  r('training-2', 'A short session on a tired day is still a session.', 'training', 'calm', ['MORNING']),
  r('training-3', "Strength arrives in workouts you don't remember individually.", 'training', 'reflective', ['POST_COMPLETE']),
  r('training-4', "You're not training for today. You're training for the version of this in ninety days.", 'training', 'reflective', ['PRE_DEEP']),
  r('training-5', 'Showing up moved the number. Feeling like it was never required.', 'training', 'direct', ['POST_COMPLETE']),

  // study
  r('study-1', 'Understanding arrives after the confusion, not instead of it.', 'study', 'reflective', ['PRE_DEEP']),
  r('study-2', 'The concept that felt foreign a month ago is the one you used without noticing today.', 'study', 'celebratory', ['POST_COMPLETE']),
  r('study-3', "You don't need to feel ready. You need to open the material.", 'study', 'direct', ['MORNING']),
  r('study-4', 'Nobody understands the topic before they sit with it. Sit with it.', 'study', 'direct', ['PRE_DEEP']),
  r('study-5', "The block that felt wasted is still the one your brain used overnight.", 'study', 'reflective', ['EVENING']),

  // procrastination
  r('procrastination-1', 'The task is smaller than the dread about the task.', 'procrastination', 'direct', ['PRE_DEEP']),
  r('procrastination-2', "You've never regretted starting once you were five minutes in.", 'procrastination', 'calm', ['PRE_DEEP']),
  r('procrastination-3', 'Waiting for the right mood is optional. The mood is not a prerequisite.', 'procrastination', 'challenging', ['MORNING']),
  r('procrastination-4', 'The avoided task is still there tomorrow, just with less time.', 'procrastination', 'direct', ['EVENING']),
  r('procrastination-5', 'Open the file. That is the whole instruction.', 'procrastination', 'direct', ['PRE_DEEP']),

  // courage
  r('courage-1', 'Sending it before it feels ready is the actual skill.', 'courage', 'direct', ['EVENING']),
  r('courage-2', 'The version of this that scares you slightly is usually the right-sized one.', 'courage', 'challenging', ['MORNING']),
  r('courage-3', 'Nobody watching would know how much this cost you to start. Start anyway.', 'courage', 'calm', ['PRE_DEEP']),
  r('courage-4', 'The application you almost skipped is usually the one worth sending.', 'courage', 'reflective', ['EVENING']),
  r('courage-5', "Discomfort here is information that you're at the edge of what you know, not a signal to stop.", 'courage', 'reflective', ['PRE_DEEP']),

  // identity — needs weeks of real evidence behind it to be an honest statement, not aspiration
  r('identity-1', "You are, by now, someone who shows up on the ordinary days. That's the whole identity.", 'identity', 'reflective', ['CHECKPOINT'], { min_day: 21 }),
  r('identity-2', "The habit is no longer a decision. It's just what you do now.", 'identity', 'calm', ['CHECKPOINT'], { min_day: 21 }),
  r('identity-3', 'Look at the log, not the feeling. The log says who you have been for months.', 'identity', 'reflective', ['CHECKPOINT'], { min_day: 30 }),
  r('identity-4', 'This is what someone who follows through looks like from the inside: unremarkable, repeated.', 'identity', 'reflective', ['EVENING'], { min_day: 21 }),
  r('identity-5', "You don't have to feel like this person yet. The log already says you are.", 'identity', 'calm', ['CHECKPOINT'], { min_day: 14 }),

  // long_horizon
  r('long-horizon-1', "Day 120 doesn't need today to be dramatic. It needs today to be ordinary and done.", 'long_horizon', 'calm', ['MORNING'], { min_day: 14 }),
  r('long-horizon-2', 'None of this is urgent. All of it is cumulative.', 'long_horizon', 'reflective', ['MORNING'], { min_day: 7 }),
  r('long-horizon-3', "You won't remember which day this was. You'll feel the sum of all of them.", 'long_horizon', 'reflective', ['EVENING'], { min_day: 14 }),
  r('long-horizon-4', "The arc is long enough that today's outcome barely matters. Today's execution is what compounds.", 'long_horizon', 'calm', ['MORNING'], { min_day: 14 }),
  r('long-horizon-5', 'Twelve weeks from now runs through this exact afternoon.', 'long_horizon', 'reflective', ['PRE_DEEP'], { min_day: 7 }),

  // LEVEL_UP / BOSS — a quieter line alongside the Moment's own visual treatment
  r('level-up-1', 'The number moved because the work did. That is the entire mechanism.', 'discipline', 'reflective', ['LEVEL_UP']),
  r('level-up-2', 'Levels are a record of hours, not a judgment of talent.', 'self_efficacy', 'calm', ['LEVEL_UP']),
  r('boss-1', 'This one took weeks, not minutes. That is what real evidence costs.', 'courage', 'celebratory', ['BOSS']),
  r('boss-2', 'Four milestones like this are the actual shape of the arc, more than any single day was.', 'long_horizon', 'reflective', ['BOSS'], { min_day: 14 }),
];

/** Per-reflection mutable show-state (db.reflection_state's live shape),
 * keyed by reflection id. */
export interface ReflectionShowState {
  times_shown: number;
  last_shown_at?: string; // local_date the reflection was last shown
}

export interface ReflectionSelectionContext {
  context: ReflectionContext;
  arcDay: number;
  /** final/05 §1.2: "after a lapse, only setbacks category and only
   * calm/reflective tone." */
  isPostLapse: boolean;
  today: string; // local_date
}

function daysSinceShown(lastShownAt: string | undefined, today: string): number {
  if (!lastShownAt) return Infinity;
  // Both are local_date strings (YYYY-MM-DD) — a lexicographic day-count
  // via Date parsing, no timezone involved on either side.
  const diff = (Date.parse(today) - Date.parse(lastShownAt)) / (1000 * 60 * 60 * 24);
  return Math.floor(diff);
}

/**
 * Pure. Picks the single best-eligible reflection, or null if nothing
 * qualifies (final/05 §1.2's selection rules: cooldown respected,
 * context must match, day range must bracket, post-lapse restricted to
 * setbacks/calm/reflective). Deterministic rather than random — no
 * Math.random() is allowed in engine/ — among the eligible set, the
 * least-recently-exhausted (fewest times_shown), then highest weight,
 * then lowest id wins, which rotates content over time without needing
 * any randomness at all.
 */
export function selectReflection(
  reflections: Reflection[],
  states: Map<string, ReflectionShowState>,
  ctx: ReflectionSelectionContext
): Reflection | null {
  const eligible = reflections.filter((refl) => {
    if (!refl.context.includes(ctx.context)) return false;
    if (ctx.arcDay < refl.min_day || ctx.arcDay > refl.max_day) return false;
    if (ctx.isPostLapse && (refl.category !== 'setbacks' || (refl.tone !== 'calm' && refl.tone !== 'reflective'))) return false;
    const state = states.get(refl.id);
    if (daysSinceShown(state?.last_shown_at, ctx.today) < refl.cooldown_days) return false;
    return true;
  });

  if (eligible.length === 0) return null;

  return eligible.reduce((best, candidate) => {
    const bestShown = states.get(best.id)?.times_shown ?? 0;
    const candidateShown = states.get(candidate.id)?.times_shown ?? 0;
    if (candidateShown !== bestShown) return candidateShown < bestShown ? candidate : best;
    if (candidate.weight !== best.weight) return candidate.weight > best.weight ? candidate : best;
    return candidate.id < best.id ? candidate : best;
  });
}
