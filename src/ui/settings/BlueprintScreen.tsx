import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { revisionTimeline, type Revision } from '../../blueprint/diff';
import type { Criterion, SystemBlueprint } from '../../blueprint/schema';
import { localDate } from '../../engine/time';
import { realDeps } from '../../store/deps';
import { getEngineConfig } from '../../store/engineConfig';
import { getActiveArc } from '../../store/arc';
import { engineV2Enabled } from '../../flags';
import { useBlueprintVersions } from '../../store/systemBlueprint';
import { AmendPanel } from './AmendPanel';
import { Panel, ScreenHeader, SectionLabel } from '../kit';

const leaves = (criterion: Criterion): number[] => (criterion.kind === 'signal' ? [criterion.target] : criterion.of.flatMap(leaves));

/** "v3 · since Day 31", or "v1 · genesis" for the first. */
export function versionBadge(revision: Pick<Revision, 'version' | 'day'>): string {
  return revision.day === 0 ? `v${revision.version} · genesis` : `v${revision.version} · since Day ${revision.day}`;
}

/** The badge of the version in force today, for the row that opens this screen. */
export function currentBadge(versions: readonly SystemBlueprint[]): string {
  const config = getEngineConfig();
  const timeline = revisionTimeline(versions, localDate(realDeps.now(), config.arc.timezone, config.arc.dayBoundaryHour));
  return versionBadge(timeline.find((revision) => revision.state === 'ACTIVE') ?? timeline[timeline.length - 1]!);
}

const CLASS_WORDS: Record<SystemBlueprint['changeClass'], string> = { genesis: 'genesis', cosmetic: 'cosmetic', operational: 'operational', structural: 'structural' };

function Card({ title, testId, children }: { title: string; testId: string; children: ReactNode }) {
  return (
    <div data-testid={testId} className="mt-4">
      <SectionLabel rule className="mb-2">{title}</SectionLabel>
      <Panel cut="sm" bodyClassName="px-4 py-3">{children}</Panel>
    </div>
  );
}

const Line = ({ children }: { children: ReactNode }) => <p className="py-1 text-sm leading-[1.45] text-ink-300">{children}</p>;

/** The settled System, one card per section, read-only (platform/03 §28.5). Any version of the arc can be read. */
export function Codex({ blueprint }: { blueprint: SystemBlueprint }) {
  const engines = blueprint.domains.filter((domain) => domain.role === 'engine');
  const rankAt = new Map(blueprint.progression.rankSchedule.map((entry) => [entry.day, entry.rank]));
  return (
    <div data-testid="codex">
      <Card title="Arc" testId="codex-arc">
        <Line>{blueprint.identity.primaryObjective || 'No objective written.'}</Line>
        <Line>{blueprint.arc.lengthDays} days · {blueprint.arc.startDate} to {blueprint.arc.endDate} · {blueprint.arc.timezone}</Line>
        <Line>Wake {blueprint.arc.wakeTime} · sleep {blueprint.arc.sleepTime} · the day turns over at {String(blueprint.arc.dayBoundaryHour).padStart(2, '0')}:00</Line>
      </Card>
      <Card title="Domains" testId="codex-domains">
        {[...blueprint.domains].sort((a, b) => a.priority - b.priority).map((domain) => (
          <Line key={domain.id}><span className="font-mono text-xs uppercase tracking-[0.12em] text-accent-mid">{domain.designation}</span> · {domain.name}{domain.role === 'guardrail' ? ' (guardrail)' : domain.role === 'support' ? ' (support)' : ''}</Line>
        ))}
      </Card>
      <Card title="Quests" testId="codex-quests">
        {blueprint.quests.filter((quest) => quest.type === 'core').map((quest) => (
          <div key={quest.id} className="py-1">
            <Line>{quest.objective}</Line>
            <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-faint">Hard day: {leaves(quest.floor).join(' · ')}</p>
          </div>
        ))}
      </Card>
      {blueprint.attributes.defs.length > 0 && (
        <Card title="Attributes" testId="codex-attributes">
          {blueprint.attributes.defs.map((def) => <Line key={def.id}>{def.name}</Line>)}
        </Card>
      )}
      {blueprint.skills.length > 0 && (
        <Card title="Skills" testId="codex-skills">
          {blueprint.skills.map((tree) => <Line key={tree.id}>{tree.name} · {tree.nodes.length} parts</Line>)}
        </Card>
      )}
      <Card title="Checkpoints" testId="codex-checkpoints">
        <Line>{blueprint.progression.checkpointDays.map((day) => `Day ${day}${rankAt.get(day) ? ` (${rankAt.get(day)})` : ''}`).join(' · ')}</Line>
      </Card>
      {blueprint.bosses.length > 0 && (
        <Card title="Bosses" testId="codex-bosses">
          {blueprint.bosses.map((boss) => <Line key={boss.id}>{boss.title} · days {boss.windowStartDay}–{boss.windowEndDay}</Line>)}
        </Card>
      )}
      {engines.length > 0 && blueprint.rules.length > 0 && (
        <Card title="Rules" testId="codex-rules">
          {blueprint.rules.map((rule) => <Line key={rule.id}>{rule.id.replace(/[-_.]/g, ' ')} · {rule.enabled ? 'on' : 'off'}</Line>)}
        </Card>
      )}
    </div>
  );
}

/**
 * Profile → Settings → System → Blueprint (platform/03 §28.5): the version in force with its badge, the timeline of revisions each with its
 * diff in plain words, and any version's Codex on tap. Read-only; amending is staged elsewhere (14.2).
 */
export function BlueprintScreen() {
  const navigate = useNavigate();
  const versions = useBlueprintVersions();
  const config = getEngineConfig();
  const today = localDate(realDeps.now(), config.arc.timezone, config.arc.dayBoundaryHour);
  const timeline = useMemo(() => revisionTimeline(versions, today), [versions, today]);
  const current = timeline.find((revision) => revision.state === 'ACTIVE') ?? timeline[timeline.length - 1]!;
  const [selected, setSelected] = useState<number | null>(null);
  const shown = timeline.find((revision) => revision.version === (selected ?? current.version)) ?? current;
  const blueprint = versions.find((version) => version.version === shown.version) ?? versions[0]!;
  const inForce = versions.find((version) => version.version === current.version) ?? versions[0]!;
  // Amending is for a generated System; the owner's opt-in offers come at their checkpoint (14.5).
  const [arcId, setArcId] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    void getActiveArc().then((arc) => { if (!cancelled) setArcId(arc?.id ?? null); });
    return () => { cancelled = true; };
  }, []);
  const canAmend = engineV2Enabled() && arcId !== null && inForce.origin !== 'legacy' && !timeline.some((revision) => revision.state === 'SCHEDULED');

  return (
    <>
      <ScreenHeader title="BLUEPRINT" onBack={() => navigate('/profile/settings/system')} />
      <div className="px-gutter pb-8" data-testid="blueprint-screen">
        <p className="mt-4 font-mono text-xs uppercase tracking-[0.16em] text-accent-mid" data-testid="version-badge">{versionBadge(current)}</p>

        <SectionLabel rule className="mb-2 mt-5">Revisions</SectionLabel>
        <ol className="flex flex-col gap-2" data-testid="revisions">
          {[...timeline].reverse().map((revision) => (
            <li key={revision.version}>
              <button
                type="button"
                onClick={() => setSelected(revision.version)}
                aria-pressed={revision.version === shown.version}
                data-testid={`revision-${revision.version}`}
                className="w-full text-left"
              >
                <Panel cut="sm" bodyClassName="px-4 py-3">
                  <p className="flex items-baseline justify-between gap-3 font-mono text-xs uppercase tracking-[0.14em] text-ink-100">
                    <span>{versionBadge(revision)} · {CLASS_WORDS[revision.changeClass]}</span>
                    <span className="text-faint">{revision.state === 'ACTIVE' ? 'in force' : revision.state === 'SCHEDULED' ? `from ${revision.activeFrom}` : 'superseded'}</span>
                  </p>
                  <ul className="mt-2 space-y-1">
                    {revision.lines.map((line) => <li key={line} className="text-sm leading-[1.45] text-ink-500">{line}</li>)}
                  </ul>
                </Panel>
              </button>
            </li>
          ))}
        </ol>

        {canAmend && <AmendPanel base={inForce} arcId={arcId} onActivated={() => setSelected(null)} />}
        {engineV2Enabled() && inForce.origin !== 'legacy' && timeline.some((revision) => revision.state === 'SCHEDULED') && (
          <p className="mt-6 text-xs leading-[1.5] text-ink-500" data-testid="amend-scheduled">A change is already scheduled. Another can be staged once it has begun.</p>
        )}

        <SectionLabel rule className="mb-1 mt-6">{shown.version === current.version ? 'The System now' : `The System as of v${shown.version}`}</SectionLabel>
        <Codex blueprint={blueprint} />
      </div>
    </>
  );
}
