// The words (platform/02 §18.5, 03 §25). The global lexicon is the System's own vocabulary, fixed in
// code: a domain designation may not take one of its words, or "RANK" would mean two things on one
// screen. Everything else - designations, verbs, labels - is domain vocabulary a Blueprint carries.

/** QUEST · LEVEL · RANK · GATE · BOSS · CHECKPOINT · EVIDENCE · MASTERY · TRANSMISSION · ARC · RECOVERY · REDUCED MODE. */
export const GLOBAL_LEXICON: ReadonlySet<string> = new Set([
  'QUEST', 'LEVEL', 'RANK', 'GATE', 'BOSS', 'CHECKPOINT', 'EVIDENCE', 'MASTERY', 'TRANSMISSION', 'ARC', 'RECOVERY', 'REDUCED MODE',
]);

/** The longest designation a Blueprint may carry (V-DOM-02). */
export const MAX_DESIGNATION_LENGTH = 18;

/**
 * Whether `designation` is acceptable as a domain's name for itself: uppercase, at most 18
 * characters, not a System word. Uniqueness within a System is the validator's, not the word's.
 */
export function isValidDesignation(designation: string): boolean {
  return designation.length > 0 && designation.length <= MAX_DESIGNATION_LENGTH && designation === designation.toUpperCase() && !GLOBAL_LEXICON.has(designation);
}

/**
 * The designations an archetype offers, in the System's register (TRIAL, FORGE, ASCENSION,
 * RECONSTITUTION, WILL, VITALITY, ARCANE, GATE): 03 §25.3. The first is the default.
 */
export const ARCHETYPE_DESIGNATIONS: Readonly<Record<string, readonly string[]>> = {
  'software-practice': ['LOGIC TRIAL', 'ALGORITHM GATE', 'CODE TRIAL'],
  'career-growth': ['MANDATE', 'TENURE', 'VANGUARD'],
  'career-pipeline': ['ASCENSION', 'DESPATCH', 'CAMPAIGN'],
  'deep-build': ['FORGE', 'CONSTRUCT', 'ANVIL'],
  'exam-prep': ['ARCANE STUDY', 'KNOWLEDGE TRIAL', 'SCHOLAR TRIAL'],
  'language-learning': ['TONGUE TRIAL', 'LEXICON', 'BABEL'],
  'strength-movement': ['VITALITY TRIAL', 'PHYSICAL TRIAL', 'IRON TRIAL'],
  endurance: ['STAMINA TRIAL', 'LONG ROAD', 'PACE TRIAL'],
  'creative-practice': ['CRAFT', 'OPUS', 'ATELIER'],
  writing: ['SCRIPTORIUM', 'INKWELL', 'QUILL TRIAL'],
  'business-building': ['DOMINION', 'VENTURE', 'COUNTING HOUSE'],
  reading: ['ARCHIVE', 'LIBRARY TRIAL', 'CODEX'],
  'finance-control': ['TREASURY WARD', 'VAULT WARD', 'LEDGER WARD'],
  relationships: ['BONDS', 'FELLOWSHIP', 'HEARTH'],
  'sleep-regularity': ['RECONSTITUTION', 'DUSK WARD', 'REST WARD'],
  'attention-control': ['WILL TRIAL', 'FOCUS WARD', 'STILL MIND'],
  'health-routine': ['SUSTENANCE', 'UPKEEP', 'HEARTH WARD'],
  'spiritual-practice': ['STILLNESS', 'VIGIL', 'SANCTUM'],
  'public-speaking': ['ORATION', 'LECTERN', 'VOICE TRIAL'],
};

/** The verb a custom domain's instrument is named from ("the action verb" of 03 §26), by instrument type. */
export const CUSTOM_DESIGNATION_STEMS: Readonly<Record<string, readonly string[]>> = {
  practice_item: ['DRILL', 'REPS', 'TRIAL'],
  duration: ['FOCUS', 'DEEP WORK', 'VIGIL'],
  session: ['SESSION', 'TRAINING', 'SPAR'],
  threshold: ['MEASURE', 'LIMIT', 'WARD'],
  time_window: ['HOUR', 'WATCH', 'CLOCK'],
  artifact: ['MAKING', 'RELEASE', 'FORGE'],
  pipeline: ['REACH', 'OUTREACH', 'CAMPAIGN'],
  checklist: ['ROUTINE', 'RITUAL', 'UPKEEP'],
  study_block: ['STUDY', 'LORE', 'ARCANE'],
};

/** Reality labels that make a designation readable (it is always rendered beside one): the generic fallback per instrument type. */
export const REALITY_VERBS: Readonly<Record<string, string>> = {
  practice_item: 'practice items',
  duration: 'minutes of focused work',
  session: 'sessions',
  threshold: 'reading kept in range',
  time_window: 'time kept',
  artifact: 'things finished and shown',
  pipeline: 'reach-outs',
  checklist: 'routine kept',
  study_block: 'study blocks',
};

/**
 * Rule B5 (02 §15.2): a boss title never names an outcome other people decide. "INTERVIEW READY" is the
 * person's own readiness; "FIRST INTERVIEW LOOP" would be the market's verdict. A title matching this is refused.
 */
export const EXTERNAL_OUTCOME_TITLE = /\b(FIRST (CUSTOMER|CLIENT|SALE|HIRE|OFFER|INTERVIEW)|INTERVIEW LOOP|OFFER (RECEIVED|SIGNED|ACCEPTED)|HIRED|PROMOTED|PROMOTION|ADMITTED|ACCEPTED|REVENUE|PAYING CUSTOMER)\b/;

export function namesExternalOutcome(title: string): boolean {
  return EXTERNAL_OUTCOME_TITLE.test(title.toUpperCase());
}
