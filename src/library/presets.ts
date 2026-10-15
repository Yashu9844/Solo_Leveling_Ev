// Presets and areas (platform/03 §25.4, §23.3). A preset is DATA, not engine: archetypes in priority order, the
// guardrails that go beside them, and an arc length. An area is what the interview's INTENT stage asks about; each has
// the archetype it leads to when nothing more is said. LEGACY is not a preset - it is a pinned fixture; SOFTWARE
// ENGINEER is its nearest generated analogue, and a test documents the differences.

export interface PresetDomain {
  archetypeId: string;
  /** The few answers a preset pre-fills (a second subject needs its own name and topics). */
  answers?: { topic?: string; topics?: string[] };
}

export interface PresetDef {
  id: string;
  label: string;
  description: string;
  /** Engines (and any chosen guardrail archetypes) in priority order. */
  domains: readonly PresetDomain[];
  /** Guardrails added beside them unless the domains already name them. */
  guardrails: readonly string[];
  /** Arc length in days; 'exam' means the length follows an exam date the person gives (default 90). */
  lengthDays: number | 'exam';
}

const DEFAULT_GUARDRAILS = ['sleep-regularity', 'attention-control'] as const;

export const PRESETS: readonly PresetDef[] = [
  {
    id: 'software-engineer', label: 'SOFTWARE ENGINEER', description: 'Practice, build, apply, train.',
    domains: [{ archetypeId: 'software-practice' }, { archetypeId: 'deep-build' }, { archetypeId: 'career-pipeline' }, { archetypeId: 'strength-movement' }],
    guardrails: DEFAULT_GUARDRAILS, lengthDays: 120,
  },
  {
    id: 'career-builder', label: 'CAREER BUILDER', description: 'Apply, build, read, train.',
    domains: [{ archetypeId: 'career-pipeline' }, { archetypeId: 'deep-build' }, { archetypeId: 'reading' }, { archetypeId: 'strength-movement' }],
    guardrails: DEFAULT_GUARDRAILS, lengthDays: 90,
  },
  {
    id: 'student', label: 'STUDENT', description: 'Study, read, train, stay close to people.',
    domains: [{ archetypeId: 'exam-prep' }, { archetypeId: 'reading' }, { archetypeId: 'strength-movement' }, { archetypeId: 'relationships' }],
    guardrails: DEFAULT_GUARDRAILS, lengthDays: 120,
  },
  {
    id: 'exam-preparation', label: 'EXAM PREPARATION', description: 'Two subjects, one date.',
    domains: [
      { archetypeId: 'exam-prep', answers: { topic: 'Subject one', topics: ['Core concepts', 'Applied problems', 'Past papers'] } },
      { archetypeId: 'exam-prep', answers: { topic: 'Subject two', topics: ['Foundations', 'Worked examples', 'Mock papers'] } },
      { archetypeId: 'strength-movement' },
    ],
    guardrails: DEFAULT_GUARDRAILS, lengthDays: 'exam',
  },
  {
    id: 'fitness', label: 'FITNESS', description: 'Strength, endurance, a routine that holds.',
    domains: [{ archetypeId: 'strength-movement' }, { archetypeId: 'endurance' }, { archetypeId: 'health-routine' }],
    guardrails: DEFAULT_GUARDRAILS, lengthDays: 90,
  },
  {
    id: 'entrepreneur', label: 'ENTREPRENEUR', description: 'Reach out, ship, read, train.',
    domains: [{ archetypeId: 'business-building' }, { archetypeId: 'deep-build' }, { archetypeId: 'reading' }, { archetypeId: 'strength-movement' }],
    guardrails: DEFAULT_GUARDRAILS, lengthDays: 120,
  },
  {
    id: 'creative', label: 'CREATIVE', description: 'Make, write, speak, train.',
    domains: [{ archetypeId: 'creative-practice' }, { archetypeId: 'writing' }, { archetypeId: 'public-speaking' }, { archetypeId: 'strength-movement' }],
    guardrails: DEFAULT_GUARDRAILS, lengthDays: 90,
  },
  {
    id: 'general', label: 'GENERAL SELF-DEVELOPMENT', description: 'Read, train, keep the books, keep the ties.',
    domains: [{ archetypeId: 'reading' }, { archetypeId: 'strength-movement' }, { archetypeId: 'finance-control' }, { archetypeId: 'relationships' }],
    guardrails: DEFAULT_GUARDRAILS, lengthDays: 90,
  },
];

export const presetById = (id: string): PresetDef | undefined => PRESETS.find((preset) => preset.id === id);

/** The areas the INTENT stage offers, and the archetype each leads to when nothing more is said. */
export const AREAS: readonly { id: string; label: string; archetypeId: string | undefined }[] = [
  { id: 'career', label: 'Career', archetypeId: 'career-pipeline' },
  { id: 'knowledge', label: 'Knowledge', archetypeId: 'reading' },
  { id: 'body', label: 'Body', archetypeId: 'strength-movement' },
  { id: 'discipline', label: 'Discipline', archetypeId: 'spiritual-practice' },
  { id: 'business', label: 'Business', archetypeId: 'business-building' },
  { id: 'health', label: 'Health', archetypeId: 'health-routine' },
  { id: 'creativity', label: 'Creativity', archetypeId: 'creative-practice' },
  { id: 'relationships', label: 'Relationships', archetypeId: 'relationships' },
  { id: 'financial', label: 'Financial stability', archetypeId: 'finance-control' },
  { id: 'craft', label: 'Craft', archetypeId: 'deep-build' },
  { id: 'custom', label: 'Something else', archetypeId: undefined },
];

/** Engines added when the chosen areas bring fewer than two (V-DOM-01), in the order they are offered. */
export const DEFAULT_ENGINES = ['reading', 'strength-movement', 'deep-build'] as const;
export const DEFAULT_GUARDRAIL_ARCHETYPES = DEFAULT_GUARDRAILS;
