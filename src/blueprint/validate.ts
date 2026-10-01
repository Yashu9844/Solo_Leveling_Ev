import { addDays, compareAsc, differenceInCalendarDays, parseISO } from 'date-fns';
import { INSTRUMENT_CATALOGUE, isKnownInstrumentSignal } from '../instruments/catalog';
import { isValidTimeZone } from '../engine/time';
import { canonicalJson } from './hash';
import type { Criterion, SignalRef, SystemBlueprint } from './schema';

export interface Issue {
  code: string;
  severity: 'error' | 'warning' | 'info';
  path: string;
  system: string;
  plain: string;
}

export interface ValidationContext { today: string }

const LEXICON = new Set(['QUEST', 'LEVEL', 'RANK', 'GATE', 'BOSS', 'CHECKPOINT', 'EVIDENCE', 'MASTERY', 'TRANSMISSION', 'ARC', 'RECOVERY', 'REDUCED MODE']);
const issue = (code: string, severity: Issue['severity'], path: string, system: string, plain: string): Issue => ({ code, severity, path, system, plain });
const asNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const timeHours = (time: string): number | undefined => {
  const match = /^(\d{2}):(\d{2})$/.exec(time);
  if (!match) return undefined;
  const hour = Number(match[1]); const minute = Number(match[2]);
  return hour < 24 && minute < 60 ? hour + minute / 60 : undefined;
};

function criterionInstrumentIds(criterion: Criterion): string[] {
  return criterion.kind === 'signal' ? [criterion.instrumentId] : criterion.of.flatMap(criterionInstrumentIds);
}
function signalReferences(signal: SignalRef): string[] {
  return signal.source === 'instrument' ? [signal.instrumentId] : signal.source === 'metric' ? [signal.metricId] : [];
}

/** Pure validation at the configuration boundary. Errors block activation. */
export function validateBlueprint(blueprint: SystemBlueprint, context: ValidationContext): Issue[] {
  const issues: Issue[] = [];
  const add = (...args: Parameters<typeof issue>) => issues.push(issue(...args));
  const { arc } = blueprint;

  if (!isValidTimeZone(arc.timezone)) add('V-ARC-01', 'error', 'arc.timezone', 'THE ARC CANNOT LOCATE ITS TIMEZONE.', 'Choose a valid IANA timezone.');
  const lengthMatches = asNumber(arc.lengthDays) && arc.lengthDays >= 60 && arc.lengthDays <= 365 && differenceInCalendarDays(parseISO(arc.endDate), parseISO(arc.startDate)) + 1 === arc.lengthDays;
  if (!lengthMatches) add('V-ARC-02', 'error', 'arc', 'THE ARC LENGTH IS INVALID.', 'Length must be 60–365 days and end on its calculated final day.');
  const earliest = addDays(parseISO(context.today), -14); const latest = addDays(parseISO(context.today), 30);
  const start = parseISO(arc.startDate);
  if (Number.isNaN(start.getTime()) || compareAsc(start, earliest) < 0 || compareAsc(start, latest) > 0) add('V-ARC-03', 'error', 'arc.startDate', 'THE ARC START IS OUTSIDE THE ACTIVATION WINDOW.', 'Start between 14 days ago and 30 days from today.');
  const sleep = timeHours(arc.sleepTime); const expectedBoundary = sleep === undefined ? undefined : (Math.floor(sleep + 2) % 24);
  const closeGap = (arc.dayBoundaryHour - arc.dayCloseHour + 24) % 24;
  if (!Number.isInteger(arc.dayBoundaryHour) || !Number.isInteger(arc.dayCloseHour) || expectedBoundary !== arc.dayBoundaryHour || closeGap > 3) add('V-ARC-04', 'error', 'arc', 'THE DAY BOUNDARY DOES NOT FIT THE SLEEP RHYTHM.', 'Set the boundary two hours after sleep and close it 0–3 hours earlier.');

  const core = blueprint.domains.filter((domain) => domain.role !== 'support');
  const engines = blueprint.domains.filter((domain) => domain.role === 'engine');
  const guardrails = blueprint.domains.filter((domain) => domain.role === 'guardrail');
  const support = blueprint.domains.filter((domain) => domain.role === 'support');
  if (core.length < 4 || core.length > 8 || engines.length < 2 || guardrails.length < 1 || support.length > 3) add('V-DOM-01', 'error', 'domains', 'THE DOMAIN BALANCE IS INVALID.', 'Use 4–8 engine/guardrail domains, at least 2 engines, 1 guardrail, and at most 3 support domains.');
  const designations = blueprint.domains.map((domain) => domain.designation);
  if (designations.some((designation) => !designation || designation.length > 18 || designation !== designation.toUpperCase() || LEXICON.has(designation)) || new Set(designations).size !== designations.length) add('V-DOM-02', 'error', 'domains', 'DOMAIN DESIGNATIONS COLLIDE WITH THE SYSTEM.', 'Use unique uppercase designations of 18 characters or fewer, excluding System terms.');
  const duplicates = blueprint.domains.some((domain, index) => blueprint.domains.slice(index + 1).some((other) => {
    const sameInstrument = domain.instrumentIds.some((id) => other.instrumentIds.includes(id));
    const sameArchetype = !!domain.archetypeId && domain.archetypeId === other.archetypeId;
    return sameInstrument || sameArchetype && domain.instrumentIds.some((id) => other.instrumentIds.includes(id));
  }));
  const instrumentShapes = blueprint.instruments.map((instrument) => `${instrument.type}:${canonicalJson(instrument.params)}`);
  if (duplicates || new Set(instrumentShapes).size !== instrumentShapes.length) add('V-DOM-03', 'error', 'domains', 'THE SYSTEM CONTAINS DUPLICATE DOMAINS.', 'Each domain needs distinct instruments and parameters.');
  for (const domain of core) if (blueprint.quests.filter((quest) => quest.domainId === domain.id && quest.type === 'core').length !== 1) add('V-DOM-04', 'error', `domains.${domain.id}`, 'A CORE DOMAIN IS MISSING ITS QUEST.', 'Every engine and guardrail domain needs exactly one core quest.');

  for (const instrument of blueprint.instruments) {
    const entry = INSTRUMENT_CATALOGUE[instrument.type];
    if (!entry || entry.requiredParams.some((key) => !(key in instrument.params)) || Object.entries(entry?.numericBounds ?? {}).some(([key, bound]) => {
      const value = instrument.params[key]; return value !== undefined && (!asNumber(value) || value < bound.min || value > bound.max);
    })) add('V-INS-01', 'error', `instruments.${instrument.id}`, 'AN INSTRUMENT EXCEEDS ITS CONTRACT.', 'Use a supported type and parameters inside its allowed bounds.');
    if (instrument.type === 'time_window' && (!asNumber(instrument.params.toleranceMinutes) || instrument.params.toleranceMinutes < 10 || instrument.params.toleranceMinutes > 90)) add('V-INS-02', 'error', `instruments.${instrument.id}.params.toleranceMinutes`, 'THE TIME WINDOW IS NOT PLAUSIBLE.', 'Use a tolerance between 10 and 90 minutes.');
    if (instrument.type === 'threshold' && Array.isArray(instrument.params.plausibleBand)) {
      const [min, max] = instrument.params.plausibleBand;
      if (!asNumber(min) || !asNumber(max) || !asNumber(instrument.params.target) || instrument.params.target < min || instrument.params.target > max) add('V-INS-02', 'error', `instruments.${instrument.id}.params.target`, 'THE THRESHOLD IS OUTSIDE ITS PLAUSIBLE BAND.', 'Keep the target inside the archetype’s plausible band.');
    }
  }

  const domainIds = new Set(blueprint.domains.map((item) => item.id)); const instrumentIds = new Set(blueprint.instruments.map((item) => item.id));
  const metricIds = new Set(blueprint.metrics.map((item) => item.id)); const milestoneIds = new Set(blueprint.milestones.map((item) => item.id)); const questIds = new Set(blueprint.quests.map((item) => item.id));
  const bad = (condition: boolean, path: string) => { if (condition) add('V-REF-01', 'error', path, 'A SYSTEM REFERENCE HAS NO TARGET.', 'Reconnect this item to an existing definition.'); };
  for (const domain of blueprint.domains) { bad(domain.instrumentIds.some((id) => !instrumentIds.has(id)) || (domain.coreQuestId !== undefined && !questIds.has(domain.coreQuestId)), `domains.${domain.id}`); }
  for (const instrument of blueprint.instruments) bad(!domainIds.has(instrument.domainId), `instruments.${instrument.id}.domainId`);
  for (const quest of blueprint.quests) { bad(!domainIds.has(quest.domainId) || criterionInstrumentIds(quest.criterion).concat(criterionInstrumentIds(quest.floor), quest.bonus.map((bonus) => bonus.instrumentId)).some((id) => !instrumentIds.has(id)), `quests.${quest.id}`); }
  for (const skill of blueprint.skills) bad(!domainIds.has(skill.domainId) || !instrumentIds.has(skill.instrumentId), `skills.${skill.id}`);
  for (const metric of blueprint.metrics) bad((metric.domainId !== undefined && !domainIds.has(metric.domainId)) || ('instrumentId' in metric.source && !instrumentIds.has(metric.source.instrumentId)), `metrics.${metric.id}`);
  for (const milestone of blueprint.milestones) bad(!domainIds.has(milestone.domainId) || signalReferences(milestone.condition.signal).some((id) => !instrumentIds.has(id) && !metricIds.has(id)), `milestones.${milestone.id}`);
  for (const boss of blueprint.bosses) bad(!milestoneIds.has(boss.anchorMilestoneId), `bosses.${boss.id}.anchorMilestoneId`);
  for (const prompt of blueprint.reviews.domainPrompts) bad(!domainIds.has(prompt.domainId), `reviews.domainPrompts.${prompt.id}`);
  for (const domain of blueprint.domains) if (domain.designation && !domain.name) add('V-VOC-01', 'warning', `domains.${domain.id}.name`, 'A DESIGNATION HAS NO REALITY LABEL.', 'Add a plain-language domain name alongside the designation.');

  // Validate signal names here as a reference guard as well: the evaluator
  // can trust that every instrument signal was declared by its catalogue.
  for (const quest of blueprint.quests) for (const criterion of [quest.criterion, quest.floor]) for (const id of criterionInstrumentIds(criterion)) {
    const instrument = blueprint.instruments.find((item) => item.id === id);
    if (instrument && criterion.kind === 'signal' && !isKnownInstrumentSignal(instrument.type, criterion.signal)) bad(true, `quests.${quest.id}.criterion.signal`);
  }
  return issues;
}
