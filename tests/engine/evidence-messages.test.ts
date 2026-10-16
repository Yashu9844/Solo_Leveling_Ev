// Loop 12.1: evidence messages for a generated System - personal records, trends and correlations read from its own signals, said in templates
// that name no domain but through {label}/{with}.
import { describe, expect, it } from 'vitest';
import { instrumentIdemKey, questCompletedPayloadV2 } from '../../src/blueprint/events';
import { evidenceLines, renderTemplate } from '../../src/blueprint/evaluate/evidenceMessages';
import type { SystemBlueprint } from '../../src/blueprint/schema';
import { validateBlueprint } from '../../src/blueprint/validate';
import { selectMessage, selectSpecificMessage } from '../../src/engine/messages';
import type { SystemEvent } from '../../src/engine/types';
import { generateBlueprint } from '../../src/generator';
import { p1 } from '../fixtures/personas/p1';
import { p3 } from '../fixtures/personas/p3';
import { personaEventLog } from './support/personaEventLog';

const draft = {
  lineageId: 'msg', today: '2026-09-01', identity: { displayName: 'ADA', primaryObjective: 'x' },
  domains: [{ archetypeId: 'deep-build' }, { archetypeId: 'reading' }, { archetypeId: 'sleep-regularity' }, { archetypeId: 'attention-control' }],
  rhythm: { wakeTime: '07:00', sleepTime: '23:00' }, arc: { startDate: '2026-09-01', lengthDays: 90, timezone: 'Asia/Kolkata' },
};
const { blueprint } = generateBlueprint(draft);
const build = blueprint.domains.find((domain) => domain.archetypeId === 'deep-build')!;
const sleep = blueprint.domains.find((domain) => domain.archetypeId === 'sleep-regularity')!;
const buildQuest = blueprint.quests.find((quest) => quest.domainId === build.id && quest.type === 'core')!;
const sleepQuest = blueprint.quests.find((quest) => quest.domainId === sleep.id && quest.type === 'core')!;
const durationId = build.instrumentIds.find((id) => blueprint.instruments.find((instrument) => instrument.id === id)?.type === 'duration')!;
const unitOf = (suffix: string): string => blueprint.messaging.evidenceTemplates.find((template) => template.id === `${build.id}.${suffix}`)!.unit!;

const day = (offset: number): string => new Date(Date.parse('2026-09-01T00:00:00Z') + offset * 86_400_000).toISOString().slice(0, 10);
let counter = 0;
function event(type: SystemEvent['type'], localDate: string, payload: object, source: SystemEvent['source'] = 'user', idem?: string): SystemEvent {
  const id = `e-${String(counter++).padStart(6, '0')}`;
  return { id, type, occurred_at: `${localDate}T05:00:00Z`, local_date: localDate, arc_id: blueprint.arcId, payload: payload as Record<string, unknown>, source, idem_key: idem ?? `${type}:${id}`, schema_v: 1 };
}
function minutes(offset: number, value: number): SystemEvent {
  const id = `r-${counter}`;
  return event('INSTRUMENT_RECORDED', day(offset), { instrumentId: durationId, instrumentType: 'duration', domainId: build.id, blueprintVersion: 1, record: { minutes: value, mode: 'build', projectKey: 'p' } }, 'user', instrumentIdemKey(id));
}
const opened = (offset: number) => event('APP_OPENED', day(offset), { seconds: 0 }, 'system');
const completed = (offset: number, questId: string) =>
  event('QUEST_COMPLETED', day(offset), questCompletedPayloadV2({ instanceId: `${blueprint.arcId}::${questId}::${day(offset)}`, templateId: `${blueprint.arcId}::${questId}`, localDate: day(offset) }, { id: questId, domainId: 'x' }, 1));

describe('the templates a generated System carries', () => {
  it('say nothing but through {label}, {with} and the numbers; the validator finds none wrong', () => {
    const templates = blueprint.messaging.evidenceTemplates.filter((template) => template.kind);
    expect(templates.map((template) => `${template.tier}:${template.kind}`)).toEqual(expect.arrayContaining(['P1:record', 'P2:trend', 'P3:correlation']));
    expect(validateBlueprint(blueprint, { today: '2026-09-01' }).filter((issue) => issue.code === 'V-MSG-01')).toEqual([]);
    const names = new RegExp(blueprint.domains.flatMap((domain) => [domain.name, domain.designation]).join('|'), 'i');
    for (const template of templates) expect(template.template, template.id).not.toMatch(names);
  });

  it('a template that names a domain, an unknown domain or an unknown placeholder is an error (V-MSG-01)', () => {
    const record = blueprint.messaging.evidenceTemplates.find((template) => template.kind === 'record')!;
    const wrong = (patch: Partial<typeof record>): SystemBlueprint => ({ ...blueprint, messaging: { ...blueprint.messaging, evidenceTemplates: [{ ...record, ...patch }] } });
    for (const patch of [{ template: `${build.name}: most in a day.` }, { template: '{label}: {nonsense}.' }, { domainId: 'nobody' }, { domainId: undefined }]) {
      expect(validateBlueprint(wrong(patch), { today: '2026-09-01' }).map((issue) => issue.code), JSON.stringify(patch)).toContain('V-MSG-01');
    }
  });

  it('renders placeholders and leaves an unknown one visible', () => {
    expect(renderTemplate('{label}: {value} {unit}', { label: 'Build', value: 3, unit: 'minutes' })).toBe('Build: 3 minutes');
    expect(renderTemplate('{label} {oops}', { label: 'x' })).toBe('x {oops}');
  });
});

describe('P1 - a personal record', () => {
  const log = (today: number) => [...Array.from({ length: 10 }, (_, i) => minutes(i, 30)), minutes(today, 90)];

  it('a day that beats every earlier day, after enough days to mean something', () => {
    const record = evidenceLines(blueprint, log(10), day(10)).find((line) => line.tier === 'P1');
    expect(record?.text).toBe(`${build.name}: most ${unitOf('record')} in a day yet, 90.`);
  });

  it('not when it only ties, when there is too little history, or when the day is trivially small', () => {
    const none = (events: SystemEvent[], offset: number) => evidenceLines(blueprint, events, day(offset)).some((line) => line.tier === 'P1');
    expect(none([...Array.from({ length: 10 }, (_, i) => minutes(i, 30)), minutes(10, 30)], 10)).toBe(false);
    expect(none([minutes(0, 30), minutes(1, 90)], 1)).toBe(false);
    expect(none([...Array.from({ length: 10 }, (_, i) => minutes(i, 1)), minutes(10, 1)], 10)).toBe(false);
  });

  it('is said on the day it happened and not after', () => {
    expect(evidenceLines(blueprint, log(10), day(11)).some((line) => line.tier === 'P1')).toBe(false);
  });
});

describe('P2 - a trend', () => {
  /** Six active days in each fortnight: days 0-10 and days 14-24 (the second ends on day 27). */
  const trendLog = (current: number, previous: number) => [
    ...Array.from({ length: 6 }, (_, i) => minutes(i * 2, previous)),
    ...Array.from({ length: 6 }, (_, i) => minutes(14 + i * 2, current)),
  ];
  const trendOn = (events: SystemEvent[]) => evidenceLines(blueprint, events, day(27)).find((candidate) => candidate.tier === 'P2');

  it('improvements only, with both fortnights in the sentence', () => {
    expect(trendOn(trendLog(40, 20))?.text).toBe(`${build.name}: 240 ${unitOf('trend')} over 14 days, up from 120.`);
    expect(trendOn(trendLog(20, 40))).toBeUndefined();
    expect(trendOn(trendLog(20, 20))).toBeUndefined();
  });

  it('needs three active days in each fortnight', () => {
    expect(trendOn([minutes(0, 20), minutes(2, 20), ...Array.from({ length: 7 }, (_, i) => minutes(14 + i * 2, 40))])).toBeUndefined();
  });
});

describe('P3 - a correlation', () => {
  const days = 30;
  /** Sleep kept on the days `kept` names; the lead quest done each day when `done` says so, given whether the day before was kept. */
  function life(kept: (offset: number) => boolean, done: (afterKept: boolean) => boolean): SystemEvent[] {
    const out: SystemEvent[] = [];
    for (let i = 0; i < days; i++) {
      out.push(opened(i));
      if (kept(i)) out.push(completed(i, sleepQuest.id));
      if (i > 0 && done(kept(i - 1))) out.push(completed(i, buildQuest.id));
    }
    return out;
  }
  const alternating = (offset: number) => offset % 2 === 0;
  const correlationOn = (events: SystemEvent[]) => evidenceLines(blueprint, events, day(days)).find((candidate) => candidate.tier === 'P3');

  it('the day after a kept guardrail against the day after a miss, only when the kept days do better', () => {
    expect(correlationOn(life(alternating, (afterKept) => afterKept))?.text).toBe(`${build.name} done the day after a kept ${sleep.name}: 100%. After a miss: 0%.`);
    expect(correlationOn(life(alternating, (afterKept) => !afterKept))).toBeUndefined();
  });

  it('needs five days in each bucket', () => {
    expect(correlationOn(life((offset) => offset < 3, () => true))).toBeUndefined();
  });
});

describe('selection and legacy', () => {
  it('a record outranks a trend outranks a correlation, and every one outranks the always-available status', () => {
    const context = { today: { local_date: 'd', core_completed: 1, core_total: 4 }, trailingDays: [], evidence: [{ id: 'c', tier: 'P3' as const, text: 'C' }, { id: 'a', tier: 'P1' as const, text: 'A' }, { id: 'b', tier: 'P2' as const, text: 'B' }] };
    expect(selectSpecificMessage(context)).toBe('A');
    expect(selectSpecificMessage({ ...context, evidence: context.evidence.slice(0, 1) })).toBe('C');
    expect(selectSpecificMessage({ ...context, evidence: [] })).toBeNull();
    expect(selectMessage({ ...context, evidence: [] })).toBe('1 of 4 complete.');
  });

  it('a Blueprint without templates (the owner’s) yields no evidence lines', () => {
    expect(evidenceLines({ ...blueprint, messaging: { evidenceTemplates: [] } }, [minutes(0, 30)], day(0))).toEqual([]);
  });
});

describe('across the personas: whatever is said names only what the System has (I20)', () => {
  for (const persona of [p1, p3]) {
    it(`${persona.id}: sixty simulated days produce lines, none foreign to the Blueprint, the body or the market`, () => {
      const { blueprint: made } = generateBlueprint(persona.draft);
      const events = personaEventLog(made, persona.seed, { kind: 'steady', days: 60 });
      const lines = new Set<string>();
      for (let offset = 14; offset < 60; offset += 2) for (const line of evidenceLines(made, events, day(offset))) lines.add(`${line.tier} ${line.text}`);
      const own = made.domains.flatMap((domain) => [domain.name.toLowerCase(), domain.designation.toLowerCase()]);
      for (const text of lines) {
        expect(text).not.toMatch(/\b(weight|waist|body ?fat|kilograms|hired|customers?|revenue|forecast|you will|will reach|projected|DSA|deployment)\b/i);
        const label = text.replace(/^P\d /, '').split(':')[0]!.split(' done the day after')[0]!.trim().toLowerCase();
        expect(own.some((name) => label === name), `"${text}"`).toBe(true);
      }
      expect(lines.size).toBeGreaterThan(0);
    });
  }
});
