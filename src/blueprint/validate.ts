import { addDays, compareAsc, differenceInCalendarDays, parseISO } from 'date-fns';
import { INSTRUMENT_CATALOGUE, isKnownInstrumentSignal } from '../instruments/catalog';
import { isValidTimeZone } from '../engine/time';
import { checkpointDaysFor } from '../library/calibration';
import { isValidDesignation } from '../library/lexicon';
import { canonicalJson, hashesFor, partitionBlueprint } from './hash';
import { EVIDENCE_PLACEHOLDERS, type Criterion, type GateCondition, type SignalRef, type SystemBlueprint } from './schema';

export interface Issue {
  code: string;
  severity: 'error' | 'warning' | 'info';
  path: string;
  system: string;
  plain: string;
}

export interface ValidationContext { today: string }
export interface TransitionContext extends ValidationContext { arcDay: number; nextCheckpointDay: number }

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
  switch (signal.source) {
    case 'instrument': return [signal.instrumentId];
    case 'metric': return [signal.metricId];
    case 'sum': return signal.of.flatMap(signalReferences);
    case 'ratio': return [...signalReferences(signal.num), ...signalReferences(signal.den)];
    default: return [];
  }
}
/** Every signal a condition reads: its own, or its clauses' when it is compound. */
function conditionSignals(condition: GateCondition): SignalRef[] {
  return condition.clauses ? condition.clauses.map((clause) => clause.signal) : [condition.signal];
}
function criterionLeaves(criterion: Criterion): Extract<Criterion, { kind: 'signal' }>[] {
  return criterion.kind === 'signal' ? [criterion] : criterion.of.flatMap(criterionLeaves);
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
  // The activation window applies to a genesis document only: once an arc has started its start date is pinned (V-TRN-04), and later versions are validated long after it.
  if (blueprint.changeClass === 'genesis' && (Number.isNaN(start.getTime()) || compareAsc(start, earliest) < 0 || compareAsc(start, latest) > 0)) add('V-ARC-03', 'error', 'arc.startDate', 'THE ARC START IS OUTSIDE THE ACTIVATION WINDOW.', 'Start between 14 days ago and 30 days from today.');
  const sleep = timeHours(arc.sleepTime); const expectedBoundary = sleep === undefined ? undefined : (Math.floor(sleep + 2) % 24);
  const closeGap = (arc.dayBoundaryHour - arc.dayCloseHour + 24) % 24;
  if (!Number.isInteger(arc.dayBoundaryHour) || !Number.isInteger(arc.dayCloseHour) || expectedBoundary !== arc.dayBoundaryHour || closeGap > 3) add('V-ARC-04', 'error', 'arc', 'THE DAY BOUNDARY DOES NOT FIT THE SLEEP RHYTHM.', 'Set the boundary two hours after sleep and close it 0–3 hours earlier.');

  const core = blueprint.domains.filter((domain) => domain.role !== 'support');
  const engines = blueprint.domains.filter((domain) => domain.role === 'engine');
  const guardrails = blueprint.domains.filter((domain) => domain.role === 'guardrail');
  const support = blueprint.domains.filter((domain) => domain.role === 'support');
  if (core.length < 4 || core.length > 8 || engines.length < 2 || guardrails.length < 1 || support.length > 3) add('V-DOM-01', 'error', 'domains', 'THE DOMAIN BALANCE IS INVALID.', 'Use 4–8 engine/guardrail domains, at least 2 engines, 1 guardrail, and at most 3 support domains.');
  const designations = blueprint.domains.map((domain) => domain.designation);
  if (designations.some((designation) => !designation || !isValidDesignation(designation)) || new Set(designations).size !== designations.length) add('V-DOM-02', 'error', 'domains', 'DOMAIN DESIGNATIONS COLLIDE WITH THE SYSTEM.', 'Use unique uppercase designations of 18 characters or fewer, excluding System terms.');
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
  for (const milestone of blueprint.milestones) bad(!domainIds.has(milestone.domainId) || conditionSignals(milestone.condition).flatMap(signalReferences).some((id) => !instrumentIds.has(id) && !metricIds.has(id)), `milestones.${milestone.id}`);
  for (const boss of blueprint.bosses) bad(!milestoneIds.has(boss.anchorMilestoneId), `bosses.${boss.id}.anchorMilestoneId`);
  for (const prompt of blueprint.reviews.domainPrompts) bad(!domainIds.has(prompt.domainId), `reviews.domainPrompts.${prompt.id}`);
  for (const domain of blueprint.domains) if (domain.designation && !domain.name) add('V-VOC-01', 'warning', `domains.${domain.id}.name`, 'A DESIGNATION HAS NO REALITY LABEL.', 'Add a plain-language domain name alongside the designation.');

  // Validate signal names here as a reference guard as well: the evaluator
  // can trust that every instrument signal was declared by its catalogue.
  for (const quest of blueprint.quests) for (const criterion of [quest.criterion, quest.floor]) for (const id of criterionInstrumentIds(criterion)) {
    const instrument = blueprint.instruments.find((item) => item.id === id);
    if (instrument && criterion.kind === 'signal' && !isKnownInstrumentSignal(instrument.type, criterion.signal)) bad(true, `quests.${quest.id}.criterion.signal`);
  }

  // Part 2: rules that depend on the linked graph, after V-REF has made
  // missing ids explicit. Each check remains defensive for malformed imports.
  for (const quest of blueprint.quests) {
    const leaves = criterionLeaves(quest.criterion);
    const floorLeaves = criterionLeaves(quest.floor);
    const invalidLeaf = leaves.some((leaf) => {
      const instrument = blueprint.instruments.find((item) => item.id === leaf.instrumentId);
      return !instrument || !isKnownInstrumentSignal(instrument.type, leaf.signal) || leaf.target < 0;
    });
    if (invalidLeaf) add('V-QST-01', 'error', `quests.${quest.id}.criterion`, 'A QUEST READS AN UNKNOWN SIGNAL.', 'Reference a signal supplied by its instrument.');
    if (leaves.some((leaf) => leaf.target < 1 && leaf.comparator === '>=')) add('V-QST-02', 'error', `quests.${quest.id}.criterion`, 'THE QUEST FLOOR IS TRIVIAL.', 'Set a meaningful minimum for each leaf target.');
    if (floorLeaves.some((floor) => !leaves.some((full) => full.instrumentId === floor.instrumentId && full.signal === floor.signal && floor.target <= full.target))) add('V-QST-03', 'error', `quests.${quest.id}.floor`, 'THE FLOOR EXCEEDS THE TARGET.', 'Make each floor leaf no harder than the matching full criterion.');
    if (quest.schedule.kind === 'weekdays' && quest.schedule.days.length < 3) add('V-QST-04', 'error', `quests.${quest.id}.schedule.days`, 'THE WEEKLY RHYTHM IS TOO SPARSE.', 'Schedule a weekday quest on at least three days.');
    if (quest.timeWindow && [quest.timeWindow.notBefore, quest.timeWindow.notAfter].some((time) => time !== undefined && timeHours(time) === undefined)) add('V-QST-05', 'error', `quests.${quest.id}.timeWindow`, 'THE QUEST WINDOW CANNOT BE READ.', 'Use valid HH:mm times outside the closed hours.');
  }
  const coreQuests = blueprint.quests.filter((quest) => quest.type === 'core');
  const coreXp = coreQuests.reduce((sum, quest) => sum + quest.xp, 0);
  if (coreXp !== blueprint.progression.dailyCoreBudget) add('V-XP-01', 'error', 'quests', 'THE CORE ECONOMY DOES NOT BALANCE.', 'Core quest XP must equal the daily core budget.');
  if (coreQuests.some((quest) => quest.xp < 30 || quest.xp > 150)) add('V-XP-02', 'error', 'quests', 'A CORE QUEST IS OUTSIDE THE SAFE XP BAND.', 'Keep core XP between 30 and 150.');
  const smallestEngineXp = Math.min(...coreQuests.filter((quest) => blueprint.domains.find((domain) => domain.id === quest.domainId)?.role === 'engine').map((quest) => quest.xp));
  if (blueprint.domains.some((domain) => domain.channel.cap < 0 || domain.channel.cap - (blueprint.quests.find((quest) => quest.id === domain.coreQuestId)?.xp ?? 0) > smallestEngineXp)) add('V-XP-03', 'error', 'domains', 'CHANNEL HEADROOM EXCEEDS THE SYSTEM LIMIT.', 'Reduce channel headroom to no more than the smallest engine core quest.');
  if (coreQuests.some((quest) => quest.bonus.some((bonus) => bonus.amount > quest.xp * .4))) add('V-XP-04', 'error', 'quests', 'A BONUS OVERSHADOWS THE FIRST MOVE.', 'Keep each bonus at or below 40% of core XP.');
  if (blueprint.progression.dailyCap !== blueprint.progression.dailyCoreBudget * 1.4) add('V-XP-05', 'error', 'progression.dailyCap', 'THE DAILY CAP IS MISALIGNED.', 'Set the daily cap to 1.4× the core budget.');
  const unsafeSignal = (signal: SignalRef): boolean => signal.source === 'metric' ? ['external', 'body'].includes(blueprint.metrics.find((metric) => metric.id === signal.metricId)?.kind ?? '') : signal.source === 'sum' ? signal.of.some(unsafeSignal) : signal.source === 'ratio' ? unsafeSignal(signal.num) || unsafeSignal(signal.den) : false;
  if (blueprint.attributes.defs.some((attribute) => attribute.terms.some((term) => unsafeSignal(term.signal))) || blueprint.gates.some((gate) => gate.conditions.some((condition) => conditionSignals(condition).some(unsafeSignal))) || blueprint.bosses.some((boss) => boss.conditions.some((condition) => conditionSignals(condition).some(unsafeSignal)))) add('V-MET-01', 'error', 'metrics', 'UNCONTROLLED EVIDENCE ENTERED A SCORE.', 'External and body metrics cannot drive XP, gates, or attributes.');
  for (const gate of blueprint.gates) {
    if (['C', 'B', 'A', 'S'].includes(gate.rank) && !gate.conditions.some((condition) => condition.verifiability === 'public_url' || condition.verifiability === 'recorded')) add('V-GATE-01', 'error', `gates.${gate.rank}`, 'THE GATE LACKS VERIFIABLE EVIDENCE.', 'Add a public URL or recorded evidence condition.');
  }
  // V-GATE-03: ladders only rise - a milestone's C/B/A/S thresholds, and a count (or a rate) asked of the same condition at later ranks.
  const ladderOrdered = blueprint.milestones.every((milestone) => (milestone.ladder ?? []).every((rung, index, rungs) => index === 0 || rung.threshold >= rungs[index - 1]!.threshold));
  const stricterLater = (comparator: string, before: number, after: number): boolean => (comparator === '>=' || comparator === '>' ? after >= before : comparator === '<' || comparator === '<=' ? after <= before : true);
  const previousAsked = new Map<string, { comparator: string; threshold: number }>();
  let gatesOrdered = true;
  for (const gate of [...blueprint.gates].filter((candidate) => ['C', 'B', 'A', 'S'].includes(candidate.rank)).sort((a, b) => a.day - b.day)) {
    for (const condition of gate.conditions) {
      const first = condition.clauses?.[0] ?? condition;
      if (typeof first.threshold !== 'number' || first.comparator === 'between') continue;
      const before = previousAsked.get(condition.id);
      if (before && !stricterLater(first.comparator, before.threshold, first.threshold)) gatesOrdered = false;
      previousAsked.set(condition.id, { comparator: first.comparator, threshold: first.threshold });
    }
  }
  if (!ladderOrdered || !gatesOrdered) add('V-GATE-03', 'error', 'gates', 'A LADDER FALLS AS IT CLIMBS.', 'Each rank may ask for more than the one before it, never less.');
  // V-GATE-04: the D gate is the System's own (effort only, so early rank is reachable), and the checkpoints are the arc length's.
  const dGate = blueprint.gates.find((gate) => gate.rank === 'D');
  const dIsGlobal = !!dGate && dGate.conditions.length === 1 && dGate.conditions[0]!.signal.source === 'global' && dGate.conditions[0]!.signal.signal === 'consistency_14';
  const scheduled = checkpointDaysFor(blueprint.arc.lengthDays);
  const gateDays = blueprint.gates.filter((gate) => gate.rank !== 'E').sort((a, b) => a.day - b.day).map((gate) => gate.day);
  if (blueprint.gates.length > 0 && (!dIsGlobal || JSON.stringify(blueprint.progression.checkpointDays) !== JSON.stringify(scheduled) || JSON.stringify(gateDays) !== JSON.stringify(scheduled))) add('V-GATE-04', 'error', 'gates', 'THE GATES DO NOT FOLLOW THE ARC.', 'The D gate is the global consistency gate, and the checkpoints fall on the days the arc length sets.');
  for (const boss of blueprint.bosses) {
    const needed = boss.gatesRank ? blueprint.gates.find((gate) => gate.rank === boss.gatesRank)?.day : undefined;
    if (needed !== undefined && boss.windowStartDay > needed - 7) add('V-BOSS-02', 'error', `bosses.${boss.id}`, 'A BOSS OPENS TOO LATE.', 'A boss window must open at least a week before the checkpoint that needs it.');
  }
  for (const boss of blueprint.bosses) if (!boss.anchorMilestoneId || !milestoneIds.has(boss.anchorMilestoneId)) add('V-BOSS-01', 'error', `bosses.${boss.id}`, 'A BOSS HAS NO REAL-WORLD ANCHOR.', 'Anchor every boss to a milestone.');
  if (blueprint.attributes.defs.some((attribute) => attribute.combine === 'sum' && Math.abs(attribute.terms.reduce((sum, term) => sum + term.weight, 0) - 1) > .001 || attribute.combine === 'product' && attribute.terms.length > 3)) add('V-ATT-01', 'error', 'attributes', 'THE ATTRIBUTE FORMULA IS UNBALANCED.', 'Sum weights must total 1; product formulas may have at most three factors.');
  const signalUse = blueprint.attributes.defs.flatMap((attribute) => attribute.terms.map((term) => canonicalJson(term.signal)));
  if (signalUse.some((signal, index) => signalUse.indexOf(signal) !== index && signalUse.lastIndexOf(signal) !== index)) add('V-ATT-02', 'error', 'attributes', 'ONE SIGNAL IS COUNTED TOO MANY TIMES.', 'Use a signal in at most two attributes.');
  if (blueprint.attributes.defs.length && (blueprint.attributes.defs.length < 3 || blueprint.attributes.defs.length > 6 || !blueprint.attributes.defs.some((attribute) => attribute.id === 'DISCIPLINE') || blueprint.attributes.groups.length > 4)) add('V-ATT-03', 'error', 'attributes', 'THE ATTRIBUTE SET IS INCOMPLETE.', 'Use 3–6 attributes including DISCIPLINE and no more than four groups.');
  if (blueprint.skills.length > 5 || blueprint.skills.some((skill) => skill.nodes.length > 30 || skill.nodes.some((node) => node.dependsOn?.some((id) => !skill.nodes.some((candidate) => candidate.id === id))))) add('V-SKL-01', 'error', 'skills', 'A SKILL TREE HAS A BROKEN DEPENDENCY.', 'Nodes must depend only on nodes in their tree; keep trees within the size limit.');
  if (blueprint.messaging.evidenceTemplates.some((template) => template.signal !== undefined && unsafeSignal(template.signal))) add('V-MSG-01', 'error', 'messaging', 'A MESSAGE WOULD SCORE UNCONTROLLED EVIDENCE.', 'Evidence messages may only use eligible effort or performance signals.');
  // A message names its domains only through {label} and {with}, and only domains the System has (I20); a record or a trend reads an instrument signal.
  const knownDomains = new Set(blueprint.domains.map((domain) => domain.id));
  const domainWords = blueprint.domains.flatMap((domain) => [domain.name, domain.designation]).map((word) => word.trim().toLowerCase()).filter((word) => word.length > 2);
  const badMessage = (template: SystemBlueprint['messaging']['evidenceTemplates'][number]): boolean => {
    const placeholders = [...template.template.matchAll(/\{([a-z]+)\}/g)].map((match) => match[1]!);
    if (placeholders.some((name) => !(EVIDENCE_PLACEHOLDERS as readonly string[]).includes(name))) return true;
    const text = template.template.replace(/\{[a-z]+\}/g, ' ').toLowerCase();
    if (domainWords.some((word) => text.includes(word))) return true;
    if (template.domainId !== undefined && !knownDomains.has(template.domainId)) return true;
    if (template.withDomainId !== undefined && !knownDomains.has(template.withDomainId)) return true;
    if ((placeholders.includes('label') || template.kind !== undefined) && template.domainId === undefined) return true;
    if ((template.kind === 'record' || template.kind === 'trend') && template.signal?.source !== 'instrument') return true;
    return template.kind === 'correlation' && template.withDomainId === undefined;
  };
  if (blueprint.messaging.evidenceTemplates.some(badMessage)) add('V-MSG-01', 'error', 'messaging', 'A MESSAGE NAMES WHAT THE SYSTEM DOES NOT HAVE.', 'Evidence messages may use only their placeholders, must point at domains in this System, and may not spell a domain out.');
  return issues;
}

export type ComputedChangeClass = 'cosmetic' | 'operational' | 'structural';

/** Classifications are derived from the documents, never trusted from input. */
export async function computeChangeClass(previous: SystemBlueprint, next: SystemBlueprint): Promise<ComputedChangeClass> {
  const previousParts = partitionBlueprint(previous); const nextParts = partitionBlueprint(next);
  if (canonicalJson(previousParts.computational) === canonicalJson(nextParts.computational)) return 'cosmetic';
  const structural = previous.arc.startDate !== next.arc.startDate || previous.arc.timezone !== next.arc.timezone || canonicalJson(previous.progression) !== canonicalJson(next.progression)
    || previous.domains.some((domain) => !next.domains.some((candidate) => candidate.id === domain.id))
    || next.domains.some((domain) => !previous.domains.some((candidate) => candidate.id === domain.id))
    || previous.instruments.some((instrument) => next.instruments.find((candidate) => candidate.id === instrument.id)?.type !== instrument.type);
  return structural ? 'structural' : 'operational';
}

export async function validateTransition(previous: SystemBlueprint, next: SystemBlueprint, context: TransitionContext): Promise<Issue[]> {
  const issues: Issue[] = [];
  const add = (...args: Parameters<typeof issue>) => issues.push(issue(...args));
  const computed = await computeChangeClass(previous, next);
  const nextIsToday = next.activeFrom === context.today;
  if (next.activeFrom < context.today || (computed !== 'cosmetic' && nextIsToday)) add('V-TRN-01', 'error', 'activeFrom', 'THE SYSTEM CANNOT REWRITE HISTORY.', 'Activate cosmetic edits today; schedule other edits after today.');
  if (next.changeClass !== computed) add('V-TRN-02', 'error', 'changeClass', 'THE CHANGE CLASS DOES NOT MATCH THE SYSTEM DIFF.', `This change is ${computed}.`);
  if (computed === 'structural' && context.arcDay > 7 && differenceInCalendarDays(parseISO(next.activeFrom), parseISO(context.today)) !== context.nextCheckpointDay - context.arcDay) add('V-TRN-03', 'error', 'activeFrom', 'STRUCTURAL CHANGE MUST WAIT FOR A CHECKPOINT.', 'Activate the change on the day after the next checkpoint seal.');
  if (context.arcDay > 1 && (previous.arc.startDate !== next.arc.startDate || previous.arc.timezone !== next.arc.timezone || canonicalJson(previous.progression) !== canonicalJson(next.progression))) add('V-TRN-04', 'error', 'arc', 'A PINNED ARC SETTING CHANGED.', 'Progression, start date, and timezone are fixed after day 1.');
  for (const oldDomain of previous.domains) {
    const continued = next.domains.find((domain) => domain.id === oldDomain.id);
    if (continued && oldDomain.instrumentIds.some((id) => {
      const oldType = previous.instruments.find((instrument) => instrument.id === id)?.type;
      const newType = next.instruments.find((instrument) => instrument.id === id)?.type;
      return oldType !== newType;
    })) add('V-TRN-05', 'error', `domains.${oldDomain.id}`, 'A DOMAIN CHANGED ITS INSTRUMENT TYPE.', 'Retire it and create a new domain id instead.');
  }
  // Hash calculation is deliberately exercised at the transition boundary:
  // cosmetic documents must retain their computational fingerprint.
  const hashes = await Promise.all([hashesFor(previous), hashesFor(next)]);
  if (computed === 'cosmetic' && hashes[0].computationalHash !== hashes[1].computationalHash) add('V-TRN-02', 'error', 'changeClass', 'COSMETIC CHANGE ALTERED COMPUTATION.', 'Restore the previous computational configuration.');
  return issues;
}
