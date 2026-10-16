// What stands between the Reveal and a System that is online (platform/03 §24.1, §28.4). The generator and the validator each speak; this
// puts them in one list, in the System's voice with the plain line beneath, with a one-tap correction wherever one exists. Errors block
// activation; warnings need one acknowledgement; info is only shown. Pure: the clock is an input.
import { validateBlueprint, type Issue } from '../blueprint/validate';
import type { SystemBlueprint } from '../blueprint/schema';
import { domainKey, type Pins } from './pins';

export type Fix =
  /** Build the System again from the same answers with today's date (the Reveal stood open past the activation window). */
  | { kind: 'rebuild'; label: string }
  /** Let the System choose the arc's length again. */
  | { kind: 'release-arc'; label: string }
  /** Let the System choose a domain's designation again. */
  | { kind: 'release-designation'; label: string; key: string };

export interface IssueView {
  issue: Issue;
  fix?: Fix;
}

export interface ActivationReport {
  errors: IssueView[];
  warnings: IssueView[];
  info: IssueView[];
}

/** Whether the System may be brought online: no errors, and any warnings acknowledged. */
export const canActivate = (report: ActivationReport, acknowledged: boolean): boolean =>
  report.errors.length === 0 && (report.warnings.length === 0 || acknowledged);

function fixFor(issue: Issue, blueprint: SystemBlueprint, pins: Pins): Fix | undefined {
  if (issue.code === 'V-ARC-03') return { kind: 'rebuild', label: 'Begin today' };
  if (issue.code === 'V-ARC-02' && pins.arcLength !== undefined) return { kind: 'release-arc', label: 'Use the System’s length' };
  const designation = /^domains\.(.+)\.designation$/.exec(issue.path);
  if (designation) {
    const domain = blueprint.domains.find((candidate) => candidate.id === designation[1]);
    const key = domain ? domainKey(domain.archetypeId ?? domain.id, domain.name) : undefined;
    if (domain && key && pins.domains[key]?.designation !== undefined) return { kind: 'release-designation', label: `Use ${domain.designation}`, key };
  }
  return undefined;
}

export function reportFor(blueprint: SystemBlueprint, generatorIssues: readonly Issue[], today: string, pins: Pins): ActivationReport {
  const seen = new Set<string>();
  const all: Issue[] = [];
  for (const issue of [...validateBlueprint(blueprint, { today }), ...generatorIssues]) {
    const key = `${issue.code}|${issue.path}`;
    if (!seen.has(key)) { seen.add(key); all.push(issue); }
  }
  const view = (severity: Issue['severity']): IssueView[] => all.filter((issue) => issue.severity === severity).map((issue) => ({ issue, fix: fixFor(issue, blueprint, pins) }));
  return { errors: view('error'), warnings: view('warning'), info: view('info') };
}
