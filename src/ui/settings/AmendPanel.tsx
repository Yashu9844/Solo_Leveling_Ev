import { useEffect, useMemo, useState } from 'react';
import { differenceInCalendarDays, parseISO } from 'date-fns';
import { planAmendment, stageOp, type AmendmentPlan, type AmendOp } from '../../blueprint/amend';
import type { SystemBlueprint } from '../../blueprint/schema';
import { localDate } from '../../engine/time';
import { activateBlueprint } from '../../store/blueprint';
import { checkpointSealedToday } from '../../store/checkpoint';
import { clearDraft, loadDraft, saveDraft } from '../../store/amendDraft';
import { realDeps } from '../../store/deps';
import { getEngineConfig } from '../../store/engineConfig';
import { Field, Panel, PrimaryButton, SecondaryButton, SectionLabel, TextInput } from '../kit';

const STEP = 5;

/** The percentage a staged edit of this kind currently applies to a quest (0 when none). */
const percentOf = (ops: readonly AmendOp[], kind: 'target' | 'floor', questId: string): number =>
  (ops.find((op) => op.kind === kind && op.questId === questId) as Extract<AmendOp, { percent: number }> | undefined)?.percent ?? 0;

const CLASS_TEXT = { cosmetic: 'COSMETIC', operational: 'OPERATIONAL', structural: 'STRUCTURAL' } as const;

/**
 * Amend the System (platform/03 §28.5): edits are staged into a draft; the change class and when it would take effect are computed from the
 * diff and shown before anything is written; nothing the validator refuses can be activated. A structural draft waits for the checkpoint's
 * Amend step (the first week excepted).
 */
export function AmendPanel({ base, arcId, onActivated }: { base: SystemBlueprint; arcId: string; onActivated: () => void }) {
  const config = getEngineConfig();
  const today = localDate(realDeps.now(), config.arc.timezone, config.arc.dayBoundaryHour);
  const arcDay = differenceInCalendarDays(parseISO(today), parseISO(base.arc.startDate)) + 1;
  const nextCheckpointDay = base.progression.checkpointDays.find((day) => day >= arcDay);
  const [ops, setOps] = useState<AmendOp[]>(() => loadDraft(arcId, base.version));
  const [plan, setPlan] = useState<AmendmentPlan | null>(null);
  // On the day a checkpoint is sealed, a structural change is allowed and begins tomorrow (the checkpoint's Amend step).
  const [sealedToday, setSealedToday] = useState(false);
  useEffect(() => {
    let cancelled = false;
    void checkpointSealedToday(today, config).then((sealed) => { if (!cancelled) setSealedToday(sealed); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [today]);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const cores = base.quests.filter((quest) => quest.type === 'core');
  const designationOf = (domainId: string): string => base.domains.find((domain) => domain.id === domainId)?.designation ?? domainId;
  const questName = (questId: string): string => { const quest = base.quests.find((candidate) => candidate.id === questId); return quest ? designationOf(quest.domainId) : questId; };

  const [renameDomain, setRenameDomain] = useState(base.domains[0]?.id ?? '');
  const [renameTo, setRenameTo] = useState('');
  // Weight moves from the heaviest quest to the lightest unless the person chooses otherwise: that is the move that stays inside the XP band.
  const byWeight = [...cores].sort((x, y) => y.xp - x.xp);
  const [fromQuest, setFromQuest] = useState(byWeight[0]?.id ?? '');
  const [toQuest, setToQuest] = useState(byWeight[byWeight.length - 1]?.id ?? '');

  useEffect(() => {
    let cancelled = false;
    void planAmendment(base, ops, { today, arcDay, nextCheckpointDay, sealedToday }).then((next) => {
      if (!cancelled) setPlan(next);
    });
    return () => { cancelled = true; };
  }, [base, ops, today, arcDay, nextCheckpointDay, sealedToday]);

  function change(next: AmendOp[]): void {
    setOps(next);
    setFailure(null);
    saveDraft(arcId, base.version, next);
  }
  function step(kind: 'target' | 'floor', questId: string, by: number): void {
    const percent = percentOf(ops, kind, questId) + by;
    change(percent === 0 ? ops.filter((op) => !(op.kind === kind && op.questId === questId)) : stageOp(ops, { kind, questId, percent }));
  }
  const describe = (op: AmendOp): string => {
    switch (op.kind) {
      case 'designation': return `${designationOf(op.domainId)} → ${op.value.trim().toUpperCase()}`;
      case 'target': return `${questName(op.questId)}: target ${op.percent > 0 ? '+' : ''}${op.percent}%`;
      case 'floor': return `${questName(op.questId)}: hard day ${op.percent > 0 ? '+' : ''}${op.percent}%`;
      case 'days': return `${questName(op.questId)}: ${op.days ? op.days.join(', ') : 'every day'}`;
      case 'weight': return `${op.xp} XP from ${questName(op.fromQuestId)} to ${questName(op.toQuestId)}`;
    }
  };

  async function activate(): Promise<void> {
    if (!plan || plan.status !== 'ready' || busy) return;
    setBusy(true);
    try {
      await activateBlueprint(plan.candidate, today, realDeps);
      clearDraft();
      setOps([]);
      onActivated();
    } catch (error) {
      setFailure(error instanceof Error ? error.message : 'The System refused this change.');
    } finally {
      setBusy(false);
    }
  }

  const errors = plan?.issues.filter((issue) => issue.severity === 'error') ?? [];
  const warnings = plan?.issues.filter((issue) => issue.severity === 'warning') ?? [];
  const staged = useMemo(() => ops.map((op) => ({ op, text: describe(op) })), [ops]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div data-testid="amend-panel">
      <SectionLabel rule className="mb-2 mt-6">Amend</SectionLabel>
      <Panel cut="sm" bodyClassName="px-4 py-4">
        <p className="text-xs leading-[1.5] text-ink-500">Stage edits, see what kind of change they are and when they would begin, then activate. Nothing is written until you do, and the past never changes.</p>

        <div className="mt-4 flex flex-col gap-3" data-testid="amend-rename">
          <Field label="Rename a domain">
            <select value={renameDomain} onChange={(event) => setRenameDomain(event.target.value)} className="min-h-tap w-full rounded-md bg-void-raised px-3 text-sm text-ink-100" data-testid="amend-rename-domain">
              {base.domains.map((domain) => <option key={domain.id} value={domain.id}>{domain.designation} · {domain.name}</option>)}
            </select>
          </Field>
          <TextInput value={renameTo} onChange={(event) => setRenameTo(event.target.value)} maxLength={18} placeholder="NEW DESIGNATION" data-testid="amend-rename-to" />
          <SecondaryButton disabled={renameTo.trim().length < 2} onClick={() => { change(stageOp(ops, { kind: 'designation', domainId: renameDomain, value: renameTo })); setRenameTo(''); }}>Stage rename</SecondaryButton>
        </div>

        <div className="mt-5" data-testid="amend-targets">
          <p className="mb-2 text-xs uppercase tracking-[0.14em] text-ink-700">Targets · within 25% stays operational</p>
          {cores.map((quest) => (
            <div key={quest.id} className="flex items-center justify-between gap-2 py-1" data-testid={`amend-target-${quest.id}`}>
              <span className="min-w-0 flex-1 truncate text-sm text-ink-300">{questName(quest.id)}</span>
              <button type="button" aria-label={`Lower ${questName(quest.id)} target`} className="min-h-tap min-w-tap rounded-md border border-hair px-3 text-ink-100" onClick={() => step('target', quest.id, -STEP)}>−</button>
              <span className="w-14 text-center font-mono text-sm tabular-nums text-accent-mid" data-testid={`amend-target-value-${quest.id}`}>{percentOf(ops, 'target', quest.id) > 0 ? '+' : ''}{percentOf(ops, 'target', quest.id)}%</span>
              <button type="button" aria-label={`Raise ${questName(quest.id)} target`} className="min-h-tap min-w-tap rounded-md border border-hair px-3 text-ink-100" onClick={() => step('target', quest.id, STEP)}>+</button>
            </div>
          ))}
        </div>

        <div className="mt-5 flex flex-col gap-3" data-testid="amend-weight">
          <p className="text-xs uppercase tracking-[0.14em] text-ink-700">Weight · always structural</p>
          <div className="flex items-center gap-2">
            <select value={fromQuest} onChange={(event) => setFromQuest(event.target.value)} aria-label="Take weight from" className="min-h-tap min-w-0 flex-1 rounded-md bg-void-raised px-2 text-sm text-ink-100" data-testid="amend-weight-from">
              {cores.map((quest) => <option key={quest.id} value={quest.id}>{questName(quest.id)}</option>)}
            </select>
            <span className="text-ink-700">→</span>
            <select value={toQuest} onChange={(event) => setToQuest(event.target.value)} aria-label="Give weight to" className="min-h-tap min-w-0 flex-1 rounded-md bg-void-raised px-2 text-sm text-ink-100" data-testid="amend-weight-to">
              {cores.map((quest) => <option key={quest.id} value={quest.id}>{questName(quest.id)}</option>)}
            </select>
          </div>
          <SecondaryButton disabled={fromQuest === toQuest} onClick={() => change(stageOp(ops, { kind: 'weight', fromQuestId: fromQuest, toQuestId: toQuest, xp: 10 }))}>Move 10 XP</SecondaryButton>
        </div>
      </Panel>

      {staged.length > 0 && plan && (
        <div className="mt-4" data-testid="amend-draft">
          <SectionLabel rule className="mb-2">Draft</SectionLabel>
          <Panel cut="sm" bodyClassName="px-4 py-4">
            <ul className="space-y-1">
              {staged.map(({ op, text }) => (
                <li key={text} className="flex items-center justify-between gap-3 text-sm text-ink-300">
                  <span>{text}</span>
                  <button type="button" aria-label={`Remove ${text}`} className="min-h-tap min-w-tap text-ink-700" onClick={() => change(ops.filter((other) => other !== op))}>✕</button>
                </li>
              ))}
            </ul>
            <p className="mt-3 font-mono text-xs uppercase tracking-[0.14em] text-accent-mid" data-testid="amend-class">{CLASS_TEXT[plan.changeClass]}</p>
            <p className="mt-1 font-mono text-xs uppercase tracking-[0.14em] text-ink-500" data-testid="amend-effect">{plan.effect}</p>
            {(errors.length > 0 || warnings.length > 0) && (
              <ul className="mt-3 space-y-2" data-testid="amend-issues">
                {[...errors, ...warnings].map((found) => (
                  <li key={`${found.code}|${found.path}`} className="text-xs leading-[1.5] text-ink-500"><span className="text-ink-100">{found.system}</span> {found.plain}</li>
                ))}
              </ul>
            )}
            {failure && <p className="mt-3 text-xs text-ink-100" role="alert">{failure}</p>}
            <div className="mt-4 flex flex-col gap-2">
              <PrimaryButton size="md" disabled={plan.status !== 'ready' || busy} onClick={() => void activate()} data-testid="amend-activate">
                {plan.status === 'waits-for-checkpoint' ? `Waits for the Day ${nextCheckpointDay ?? ''} checkpoint` : busy ? 'Activating…' : 'Activate'}
              </PrimaryButton>
              <SecondaryButton onClick={() => { clearDraft(); setOps([]); }} data-testid="amend-discard">Discard draft</SecondaryButton>
            </div>
          </Panel>
        </div>
      )}
    </div>
  );
}
