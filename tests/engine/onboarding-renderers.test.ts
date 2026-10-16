// Loop 10.3: every kind of question renders from its definition, with a name a screen reader can use and targets a thumb can hit.
// Server-rendered (no DOM in this suite): what is checked is the markup the interview emits, not its pixels - those are the device review.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { QUESTIONS, RESOLUTIONS } from '../../src/onboarding/content';
import { defaultFor, livePlan, optionsFor, withDefaults } from '../../src/onboarding/engine';
import type { QuestionInstance } from '../../src/onboarding/types';
import { QuestionView } from '../../src/ui/onboarding/adaptive/QuestionView';

const today = '2026-09-01';
const AREAS = Object.keys(RESOLUTIONS);
const everything = withDefaults({ tier: 'guided', answers: { 'identity.displayName': 'Ada', areas: ['knowledge', 'body', 'career'], 'area.knowledge.resolution': 'exam-prep', 'area.body.resolution': 'endurance' } }, QUESTIONS, { today });

function render(instance: QuestionInstance, answers = everything.answers, value?: unknown): string {
  return renderToStaticMarkup(createElement(QuestionView, {
    instance, options: optionsFor(instance, answers), answers, value: value ?? answers[instance.writes] ?? defaultFor(instance, answers, { today }), onChange: () => undefined,
  }));
}

describe('question renderers', () => {
  const plan = livePlan(everything, QUESTIONS);

  it('renders every question the interview can ask, under its own heading', () => {
    expect(plan.length).toBeGreaterThan(20);
    const kinds = new Set<string>();
    for (const instance of plan) {
      kinds.add(instance.def.kind);
      const html = render(instance);
      expect(html, instance.key).toContain(`data-testid="question-${instance.key}"`);
      expect(html, instance.key).toContain(instance.heading.replace(/&/g, '&amp;'));
    }
    // The walk exercises every kind the content uses.
    expect([...kinds].sort()).toEqual(['date', 'dial', 'multi_card', 'number', 'rank', 'single_card', 'text_list', 'text_short', 'time']);
  });

  it('cards are radios or checkboxes with a state, and each is a tap target of at least 44px', () => {
    const resolution = plan.find((instance) => instance.key === 'resolution@knowledge')!;
    const single = render(resolution);
    expect(single).toContain('role="radiogroup"');
    expect(single.match(/role="radio"/g)?.length).toBe(RESOLUTIONS.knowledge!.length);
    expect(single).toContain('aria-checked="true"');
    expect(single).toContain('min-h-[56px]');
    const areas = plan.find((instance) => instance.key === 'areas')!;
    const multi = render(areas);
    expect(multi).toContain('role="checkbox"');
    expect(multi).toMatch(/CHOSEN/);
    expect(multi.match(/role="checkbox"/g)?.length).toBe(10);
  });

  it('a rank question is a list with a named up and down button on every row', () => {
    const rank = plan.find((instance) => instance.def.kind === 'rank')!;
    const html = render(rank);
    expect(html).toContain('<ol');
    for (const area of ['Knowledge', 'Body', 'Career']) {
      expect(html).toContain(`aria-label="Move ${area} up"`);
      expect(html).toContain(`aria-label="Move ${area} down"`);
    }
    expect(html.match(/h-11 w-11/g)?.length).toBe(6);
  });

  it('a number shows its figure and unit, with named steppers and a labelled field', () => {
    const goodDay = plan.find((instance) => instance.key === 'goodDay.exam-prep@knowledge' || instance.def.id.startsWith('goodDay'))!;
    const html = render(goodDay, everything.answers, 30);
    expect(html).toContain('>30<');
    expect(html).toContain('PRACTICE QUESTIONS');
    expect(html).toContain('aria-label="Decrease"');
    expect(html).toContain('aria-label="Increase"');
    expect(html).toContain('type="number"');
    expect(html).toContain('class="sr-only"');
  });

  it('the rhythm questions show the dial; the trigger questions show the if-then readout', () => {
    expect(render(plan.find((instance) => instance.key === 'wake')!)).toContain('<svg');
    const trigger = plan.find((instance) => instance.def.id === 'triggerPlace');
    const html = render(trigger ?? plan.find((instance) => instance.def.stage === 'TRIGGERS')!, { ...everything.answers, 'area.knowledge.triggerTime': '07:30' });
    expect(html).toContain('IF · THEN');
    expect(html).toContain('07:30');
  });

  it('works for every area’s resolution cards', () => {
    for (const area of AREAS) {
      const draft = withDefaults({ tier: 'quick', answers: { 'identity.displayName': 'Ada', areas: [area, area === 'career' ? 'body' : 'career'] } }, QUESTIONS, { today });
      const instance = livePlan(draft, QUESTIONS).find((candidate) => candidate.key === `resolution@${area}`)!;
      expect(render(instance, draft.answers), area).toContain('role="radio"');
    }
  });
});

describe('the interview shell', () => {
  it('mounts on a fresh draft at the first question, with a spine of the stages this tier asks', async () => {
    const { AdaptiveInterview } = await import('../../src/ui/onboarding/adaptive/AdaptiveInterview');
    const html = renderToStaticMarkup(createElement(AdaptiveInterview, { questions: QUESTIONS, initial: { tier: 'quick', answers: {} }, today, onComplete: () => undefined }));
    expect(html).toContain('data-testid="question-name"');
    expect(html).toContain('role="progressbar"');
    expect(html).toContain('aria-valuemax="6"');
    expect(html).toContain('Begin');
    const guided = renderToStaticMarkup(createElement(AdaptiveInterview, { questions: QUESTIONS, initial: { tier: 'guided', answers: {} }, today, onComplete: () => undefined }));
    expect(guided).toContain('aria-valuemax="10"');
  });
});
