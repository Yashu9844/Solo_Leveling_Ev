// Loop 11.3: every card of the Reveal says which answer it came from, in the System's voice.
import { describe, expect, it } from 'vitest';
import { generateBlueprint } from '../../src/generator/generate';
import { QUESTIONS } from '../../src/onboarding/content';
import { PINS_KEY, clearDraft, loadPins, savePins, saveDraft } from '../../src/onboarding/draftStorage';
import { withDefaults } from '../../src/onboarding/engine';
import { interviewToDraft } from '../../src/onboarding/mapping';
import { NO_PINS, adjustables, applyPins, withArcLength, withPin } from '../../src/onboarding/pins';
import { provenanceFor } from '../../src/onboarding/provenance';

const ctx = { today: '2026-09-01' };
const mapping = { lineageId: 'lineage-prov', today: '2026-09-01', timezone: 'Asia/Kolkata' };
const memory = () => {
  const data = new Map<string, string>();
  return { data, getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); }, removeItem: (key: string) => { data.delete(key); } };
};

const interview = withDefaults({
  tier: 'guided',
  answers: {
    'identity.displayName': 'Noor', areas: ['body', 'knowledge', 'relationships'], customs: 'Piano', priorities: ['knowledge', 'custom1', 'body', 'relationships'],
    'area.knowledge.resolution': 'exam-prep', 'area.knowledge.examDate': '2026-12-04', 'area.knowledge.goodDay': 30, 'arc.alignToExam': 'yes',
    'area.custom1.resolution': 'custom:practice_item', guardrails: ['sleep-regularity'],
  },
}, QUESTIONS, ctx);

describe('provenance', () => {
  const { draft } = interviewToDraft(interview, QUESTIONS, mapping);
  const provenance = provenanceFor(interview, QUESTIONS, draft, NO_PINS);

  it('names the answer behind each domain, with the rank the person gave it', () => {
    expect(provenance.domain['exam-prep']).toBe('BECAUSE: YOU CHOSE KNOWLEDGE, AND RANKED IT FIRST.');
    expect(provenance.domain['custom:practice_item:piano']).toBe('BECAUSE: YOU NAMED IT, AND RANKED IT SECOND.');
    expect(provenance.domain['strength-movement']).toBe('BECAUSE: YOU CHOSE BODY, AND RANKED IT THIRD.');
  });

  it('says where a guardrail came from, and when the System added an engine', () => {
    expect(provenance.domain['sleep-regularity']).toBe('BECAUSE: YOU CHOSE IT TO PROTECT YOUR CAPACITY.');
    const bare = withDefaults({ tier: 'quick', answers: { 'identity.displayName': 'Ada', areas: ['body'] } }, QUESTIONS, ctx);
    const made = interviewToDraft(bare, QUESTIONS, mapping).draft;
    const p = provenanceFor(bare, QUESTIONS, made, NO_PINS);
    expect(p.domain['sleep-regularity']).toBe('BECAUSE: THE SYSTEM PROTECTS YOUR CAPACITY WITH IT.');
    expect(Object.values(p.domain)).toContain('BECAUSE: A SYSTEM NEEDS AT LEAST TWO THINGS TO PUSH.');
  });

  it('distinguishes the person’s own good day from the usual one, and a pinned one from both', () => {
    expect(provenance.goodDay['exam-prep']).toBe('BECAUSE: YOUR GOOD DAY IS 30 PRACTICE QUESTIONS.');
    // A good day that was never asked (Quick) is the usual one; one that was shown and accepted is the person's.
    const quick = withDefaults({ tier: 'quick', answers: { 'identity.displayName': 'Ada', areas: ['body', 'career'] } }, QUESTIONS, ctx);
    const usual = provenanceFor(quick, QUESTIONS, interviewToDraft(quick, QUESTIONS, mapping).draft, NO_PINS);
    expect(usual.goodDay['strength-movement']).toMatch(/^BECAUSE: THE USUAL GOOD DAY FOR THIS WORK/);
    expect(provenance.goodDay['strength-movement']).toBe('BECAUSE: YOUR GOOD DAY IS 8000 STEPS.');
    expect(provenance.goodDay['sleep-regularity']).toBe('HELD, NOT PUSHED.');
    const pins = withPin(NO_PINS, 'exam-prep', 'goodDay', 40);
    expect(provenanceFor(interview, QUESTIONS, applyPins(draft, pins), pins).goodDay['exam-prep']).toBe('YOU ADJUSTED IT.');
  });

  it('says why the arc is the length it is', () => {
    expect(provenance.arc).toBe('BECAUSE: IT ENDS ON YOUR EXAM DATE.');
    expect(provenanceFor(interview, QUESTIONS, draft, withArcLength(NO_PINS, 100)).arc).toBe('YOU ADJUSTED IT.');
    const plain = withDefaults({ tier: 'quick', answers: { 'identity.displayName': 'Ada', areas: ['body', 'career'], 'arc.lengthDays': '90' } }, QUESTIONS, ctx);
    expect(provenanceFor(plain, QUESTIONS, interviewToDraft(plain, QUESTIONS, mapping).draft, NO_PINS).arc).toBe('BECAUSE: YOU CHOSE 90 DAYS.');
  });

  it('every line follows the voice rules: capitals, no praise, no prediction', () => {
    const lines = [provenance.arc, ...Object.values(provenance.domain), ...Object.values(provenance.goodDay)];
    expect(lines.length).toBeGreaterThan(6);
    for (const line of lines) {
      expect(line).toBe(line.toUpperCase());
      expect(line).not.toMatch(/!|\b(great|well done|will (improve|succeed|achieve))\b/i);
    }
  });
});

describe('what the Reveal can adjust', () => {
  it('lists a good day and a hard day for what is pushed, and only a designation for what is held', () => {
    const { draft } = interviewToDraft(interview, QUESTIONS, mapping);
    const list = adjustables(draft);
    const exam = list.find((item) => item.key === 'exam-prep')!;
    expect(exam).toMatchObject({ goodDay: 30, hardDay: 10 });
    expect(exam.bounds?.noun).toBe('PRACTICE QUESTIONS');
    const sleep = list.find((item) => item.key === 'sleep-regularity')!;
    expect(sleep.goodDay).toBeUndefined();
    expect(sleep.bounds).toBeUndefined();
    expect(list.find((item) => item.key === 'custom:practice_item:piano')?.goodDay).toBeGreaterThan(0);
    expect(generateBlueprint(draft).issues.filter((issue) => issue.severity === 'error')).toEqual([]);
  });
});

describe('pins on the device', () => {
  it('are kept, read back, forgotten when there are none, and deleted with the draft', () => {
    const store = memory();
    const pins = withArcLength(withPin(NO_PINS, 'exam-prep', 'goodDay', 40), 100);
    savePins(pins, store);
    expect(loadPins(store)).toEqual(pins);
    savePins(NO_PINS, store);
    expect(store.data.has(PINS_KEY)).toBe(false);
    savePins(pins, store);
    saveDraft({ tier: 'quick', answers: {} }, store);
    clearDraft(store);
    expect(store.data.size).toBe(0);
  });

  it('reads nothing from what it cannot trust', () => {
    for (const bad of ['', 'nope', '[]', '{"domains":[]}', '{"domains":{"x":{"goodDay":{}}}}', '{"domains":{},"arcLength":"90"}']) {
      const store = memory();
      store.data.set(PINS_KEY, bad);
      expect(loadPins(store), bad).toBeNull();
    }
    expect(loadPins(null)).toBeNull();
  });
});
