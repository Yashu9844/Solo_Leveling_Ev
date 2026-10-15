// The owner's System speaks in its own voice ("First impact", "Despatch Ascension").
// The generic sheets default to plain labels humanized from the Blueprint's ids;
// these overrides, keyed by the legacy instrument ids, keep the owner's wording
// exactly as it has always rendered (E3, platform/05 Phase 7). Domain-specific
// literals are allowed in this folder and nowhere else under ui/ (loop 7.9).

export interface PracticeItemCopy {
  itemLabel: string;
  submittingLabel: string;
  outcomeLabels: Record<string, string>;
}

export interface PipelineCopy {
  applicationTitle: string;
  applicationSubmit: string;
  applicationSubmitting: string;
  substituteTitle: string;
  substituteSubmit: string;
  substituteSwitch: string;
  applicationSwitch: string;
  categoryLabels: Record<string, string>;
  sourceLabels: Record<string, string>;
  substituteKinds: Record<string, string>;
}

export const LEGACY_PRACTICE_COPY: Record<string, PracticeItemCopy> = {
  'dsa.problems': {
    itemLabel: 'Problem',
    submittingLabel: 'Recording…',
    outcomeLabels: { first_attempt: 'First impact', hint: 'Clue', editorial: 'Decree', unsolved: 'Unresolved' },
  },
};

export const LEGACY_PIPELINE_COPY: Record<string, PipelineCopy> = {
  'career.applications': {
    applicationTitle: 'Despatch Ascension',
    applicationSubmit: 'Despatch Ascension',
    applicationSubmitting: 'Despatching…',
    substituteTitle: 'Substitute Ascension Work',
    substituteSubmit: 'Log substitute work',
    substituteSwitch: 'Substitute ascension work instead',
    applicationSwitch: 'Despatch an ascension instead',
    categoryLabels: { backend: 'Backend', ai: 'AI', fullstack: 'Fullstack', platform: 'Platform', other: 'Other' },
    sourceLabels: { jobboard: 'Board', referral: 'Referral', company_site: 'Site', recruiter: 'Recruiter', network: 'Network' },
    substituteKinds: {
      resume_iteration: 'Resume iteration', followups: 'Follow-ups', networking: 'Networking message',
      portfolio: 'Portfolio / README', writeup: 'Write-up drafting', mock: 'Mock interview',
    },
  },
};

export interface DurationCopy {
  submittingLabel: string;
  artifactKindLabels: Record<string, string>;
  shippedPlaceholder: string;
}

export const LEGACY_DURATION_COPY: Record<string, DurationCopy> = {
  'build.sessions': {
    submittingLabel: 'Forging…',
    artifactKindLabels: { feature: 'Feature', eval: 'Eval', project: 'Project', deployment: 'Deployment', writeup: 'Write-up' },
    shippedPlaceholder: 'e.g. Tool-calling retry logic',
  },
};

export interface SessionCopy {
  /** The singular the mode toggle uses for the session itself ("Session" beside "Steps"). */
  sessionLabel: string;
}

export const LEGACY_SESSION_COPY: Record<string, SessionCopy> = {
  'training.sessions': { sessionLabel: 'Session' },
};

/** The short names the owner's evening review and reminder settings call their domains by. */
export const LEGACY_REVIEW_LABELS: Record<string, string> = { career: 'Career', dsa: 'DSA', build: 'Build', training: 'Train' };
export const LEGACY_REMINDER_LABELS: Record<string, string> = { career: 'Career', dsa: 'DSA', training: 'Training' };
