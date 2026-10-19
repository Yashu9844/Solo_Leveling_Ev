// Loop 11.4: what stands between the Reveal and a System that is online.
import { describe, expect, it } from 'vitest';
import { generateBlueprint } from '../../src/generator/generate';
import { QUESTIONS } from '../../src/onboarding/content';
import { canActivate, reportFor } from '../../src/onboarding/activationIssues';
import { withDefaults } from '../../src/onboarding/engine';
import { interviewToDraft } from '../../src/onboarding/mapping';
import { NO_PINS, applyPins, withArcLength, withPin } from '../../src/onboarding/pins';

const TODAY = '2026-09-01';
const quick = withDefaults({ tier: 'quick', answers: { 'identity.displayName': 'Ada', areas: ['career', 'body'] } }, QUESTIONS, { today: TODAY });
const draft = interviewToDraft(quick, QUESTIONS, { lineageId: 'lineage-issues', today: TODAY, timezone: 'Asia/Kolkata' }).draft;
const build = (pins = NO_PINS) => generateBlueprint(applyPins(draft, pins));

describe('the activation report', () => {
  it('a generated System on its own date has nothing to correct', () => {
    const { blueprint, issues } = build();
    const report = reportFor(blueprint, issues, TODAY, NO_PINS);
    expect(report.errors).toEqual([]);
    expect(canActivate(report, false)).toBe(report.warnings.length === 0);
  });

  it('an arc that starts outside the activation window is an error in the System\u2019s voice, with a one-tap fix, and acknowledging does not unblock it', () => {
    const { blueprint, issues } = build();
    const late = reportFor(blueprint, issues, '2026-10-20', NO_PINS); // 49 days after the start
    expect(late.errors.map((view) => view.issue.code)).toContain('V-ARC-03');
    const view = late.errors.find((candidate) => candidate.issue.code === 'V-ARC-03')!;
    expect(view.issue.system).toBe('THE ARC START IS OUTSIDE THE ACTIVATION WINDOW.');
    expect(view.issue.plain).toMatch(/^Start between/);
    expect(view.fix).toEqual({ kind: 'rebuild', label: 'Begin today' });
    expect(canActivate(late, true)).toBe(false);
    // Early is just as wrong as late.
    expect(reportFor(blueprint, issues, '2026-08-01', NO_PINS).errors.map((candidate) => candidate.issue.code)).toContain('V-ARC-03');
  });

  it('a designation that cannot be used is a warning: it needs acknowledging, and a pinned one offers its release', () => {
    const key = 'career-growth';
    const pins = withPin(NO_PINS, key, 'designation', 'A DESIGNATION FAR TOO LONG TO USE');
    const { blueprint, issues } = build(pins);
    const report = reportFor(blueprint, issues, TODAY, pins);
    expect(report.errors).toEqual([]);
    const warning = report.warnings.find((view) => view.issue.code === 'G-DOM-02')!;
    expect(warning.issue.system).toBe('THAT DESIGNATION IS NOT AVAILABLE.');
    expect(warning.fix).toMatchObject({ kind: 'release-designation', key });
    expect(warning.fix!.label).toMatch(/^Use [A-Z ]+$/);
    expect(canActivate(report, false)).toBe(false);
    expect(canActivate(report, true)).toBe(true);
    // Released, the warning is gone.
    const released = build(NO_PINS);
    expect(reportFor(released.blueprint, released.issues, TODAY, NO_PINS).warnings.map((view) => view.issue.code)).not.toContain('G-DOM-02');
  });

  it('lists each issue once, and the arc pin offers its release when the length is wrong', () => {
    const { blueprint, issues } = build();
    const doubled = reportFor(blueprint, [...issues, ...issues], TODAY, NO_PINS);
    const single = reportFor(blueprint, issues, TODAY, NO_PINS);
    expect(doubled).toEqual(single);
    const broken = { ...blueprint, arc: { ...blueprint.arc, lengthDays: 20 } };
    const report = reportFor(broken, [], TODAY, withArcLength(NO_PINS, 100));
    expect(report.errors.find((view) => view.issue.code === 'V-ARC-02')?.fix).toMatchObject({ kind: 'release-arc' });
    expect(reportFor(broken, [], TODAY, NO_PINS).errors.find((view) => view.issue.code === 'V-ARC-02')?.fix).toBeUndefined();
  });

  it('every message is System voice in capitals with a plain sentence beneath, and none praises', () => {
    const { blueprint } = build();
    const report = reportFor({ ...blueprint, arc: { ...blueprint.arc, lengthDays: 20 } }, [], '2027-01-01', withArcLength(NO_PINS, 100));
    expect(report.errors.length).toBeGreaterThan(1);
    for (const { issue } of [...report.errors, ...report.warnings]) {
      expect(issue.system).toBe(issue.system.toUpperCase());
      expect(issue.plain).toMatch(/[.!?]$/);
      expect(`${issue.system} ${issue.plain}`).not.toMatch(/!|\b(great|well done)\b/i);
    }
  });
});
