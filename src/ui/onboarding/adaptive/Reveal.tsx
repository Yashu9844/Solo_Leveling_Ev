import { useState, type CSSProperties, type ReactNode } from 'react';
import type { Criterion, QuestTemplateDef, SystemBlueprint } from '../../../blueprint/schema';
import { clampPin, domainKey, type Adjustable, type Pins } from '../../../onboarding/pins';
import type { Provenance } from '../../../onboarding/provenance';
import { PrimaryButton, SafeTop, ScreenShell, SecondaryButton, Sheet } from '../../kit';
import { presentDomain } from '../../presentation/domain';
import { Instrument, StepConsole } from '../shared';
import { Cards, NumberField } from './QuestionView';

export interface RevealProps {
  blueprint: SystemBlueprint;
  name: string;
  provenance: Provenance;
  pins: Pins;
  adjustables: Adjustable[];
  /** Why the System cannot be brought online yet, in the System's voice. */
  errors: string[];
  busy: boolean;
  failure: string | null;
  onPinDomain: (key: string, values: { goodDay?: number; hardDay?: number; designation?: string }) => void;
  onPinArc: (days: number) => void;
  onUnpin: () => void;
  onChange: () => void;
  onActivate: () => void;
}

const leaves = (criterion: Criterion): number[] => (criterion.kind === 'signal' ? [criterion.target] : criterion.of.flatMap(leaves));
const floorLine = (quest: QuestTemplateDef): string => `ON A HARD DAY: ${leaves(quest.floor).join(' · ')}`;

/** A section of the Reveal: it rises in its turn (the order is the sequence), then stays as a card of the Codex. */
function Section({ seq, children, testId }: { seq: number; children: ReactNode; testId?: string }) {
  return <div className="reveal-seq" style={{ '--seq': seq } as CSSProperties} data-testid={testId}>{children}</div>;
}

const Because = ({ children }: { children: ReactNode }) => <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.14em] text-faint">{children}</p>;

/**
 * SYSTEM AWAKENED (platform/03 §28.2): what was built from the answers, in the order the System was assembled - the arc, each domain with its
 * quest and its hard-day floor, the attributes, the skill trees, the checkpoints, the bosses - settling into a Codex whose cards can be adjusted.
 * Every card says which answer it came from. Motion is CSS only and reduced motion shows the settled Codex at once.
 */
export function Reveal({ blueprint, name, provenance, pins, adjustables, errors, busy, failure, onPinDomain, onPinArc, onUnpin, onChange, onActivate }: RevealProps) {
  const [adjusting, setAdjusting] = useState<string | 'arc' | null>(null);
  const domains = [...blueprint.domains].sort((a, b) => a.priority - b.priority);
  const keyOf = (domain: SystemBlueprint['domains'][number]) => domainKey(domain.archetypeId ?? domain.id, domain.name);
  const pinned = Object.keys(pins.domains).length > 0 || pins.arcLength !== undefined;
  const target = adjusting && adjusting !== 'arc' ? adjustables.find((candidate) => candidate.key === adjusting) : undefined;
  const targetQuest = target ? blueprint.quests.find((quest) => quest.domainId === domains.find((domain) => keyOf(domain) === target.key)?.id && quest.type === 'core') : undefined;
  let seq = 1;

  return (
    <ScreenShell>
      <div className="relative flex flex-1 flex-col overflow-hidden text-ink-100">
        <div aria-hidden className="init-field pointer-events-none absolute inset-0 overflow-hidden" />
        <div className="relative flex min-h-0 flex-1 flex-col">
          <SafeTop />
          <div className="no-scrollbar min-h-0 flex-1 space-y-3 overflow-y-auto px-gutter pb-4 pt-6" data-testid="reveal">
            <Section seq={0}>
              <StepConsole
                index={domains.length} kicker="SYSTEM AWAKENED" title={`${name.toUpperCase()}, THIS IS YOUR SYSTEM`}
                lead={`${domains.length} domains, ${blueprint.quests.filter((quest) => quest.type === 'core').length} quests a day, ${blueprint.arc.lengthDays} days. Each card says which answer it came from; adjust any of them.`}
              >
                <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-500" data-testid="reveal-arc">
                  {blueprint.arc.lengthDays} days · from {blueprint.arc.startDate} to {blueprint.arc.endDate}
                </p>
                <Because>{provenance.arc}</Because>
                <div className="mt-3">
                  <SecondaryButton onClick={() => setAdjusting('arc')} className="w-full">Adjust the arc</SecondaryButton>
                </div>
              </StepConsole>
            </Section>

            {domains.map((domain) => {
              const quest = blueprint.quests.find((candidate) => candidate.domainId === domain.id && candidate.type === 'core');
              const look = presentDomain(blueprint, domain.id);
              const key = keyOf(domain);
              const adjustable = adjustables.find((candidate) => candidate.key === key);
              const isPinned = pins.domains[key] !== undefined;
              if (!quest || !look) return null;
              const { Glyph, theme } = look;
              return (
                <Section key={domain.id} seq={seq++}>
                  <div data-testid="reveal-card" data-designation={quest.designation}>
                    <Instrument label={`${quest.designation} · ${domain.role === 'guardrail' ? 'GUARDRAIL' : 'ENGINE'}`} right={<span className="font-mono text-[10px] tabular-nums text-accent-mid">{quest.xp} XP</span>}>
                      <div className="flex items-start gap-3">
                        <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[7px]" style={{ background: theme.bg, border: `1px solid ${theme.border}`, color: theme.color, boxShadow: theme.glow }}>
                          <Glyph size={18} weight="duotone" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-ink-100">{domain.name}</p>
                          <p className="mt-1 text-sm leading-snug text-ink-100" data-testid="reveal-quest">{quest.objective}</p>
                          <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-500">{floorLine(quest)}</p>
                        </div>
                      </div>
                      <Because>{provenance.domain[key] ?? ''}</Because>
                      {adjustable && adjustable.goodDay !== undefined && <Because>{provenance.goodDay[key] ?? ''}</Because>}
                      <div className="mt-3 flex items-center gap-3">
                        <SecondaryButton onClick={() => setAdjusting(key)} className="flex-1" aria-label={`Adjust ${quest.designation}`}>Adjust</SecondaryButton>
                        {isPinned && <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-accent-mid">◆ PINNED</span>}
                      </div>
                    </Instrument>
                  </div>
                </Section>
              );
            })}

            {blueprint.attributes.defs.length > 0 && (
              <Section seq={seq++}>
                <Instrument label="ATTRIBUTES" right={<span className="font-mono text-[10px] tabular-nums text-faint">{blueprint.attributes.defs.length}</span>}>
                  <ul className="space-y-1.5">
                    {blueprint.attributes.defs.map((attribute) => (
                      <li key={attribute.id} className="text-sm leading-snug"><span className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-ink-100">{attribute.name}</span> <span className="text-ink-500">{attribute.description}</span></li>
                    ))}
                  </ul>
                  <Because>BECAUSE: THEY ARE READ FROM THE DOMAINS ABOVE. THE FORMULAS ARE FIXED.</Because>
                </Instrument>
              </Section>
            )}

            {blueprint.skills.length > 0 && (
              <Section seq={seq++}>
                <Instrument label="SKILLS">
                  <ul className="space-y-1.5">
                    {blueprint.skills.map((tree) => (
                      <li key={tree.id} className="text-sm"><span className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-ink-100">{tree.name}</span> <span className="text-ink-500">{tree.nodes.length} parts</span></li>
                    ))}
                  </ul>
                  <Because>BECAUSE: A PRACTICE BREAKS INTO PARTS YOU CAN SEE COMING LOOSE.</Because>
                </Instrument>
              </Section>
            )}

            <Section seq={seq++}>
              <Instrument label="CHECKPOINTS">
                <ol className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-100">
                  {blueprint.gates.map((gate) => <li key={`${gate.rank}${gate.day}`}><span className="text-accent-mid">{gate.rank}</span> · DAY {gate.day}</li>)}
                </ol>
                <Because>BECAUSE: THE ARC IS {blueprint.arc.lengthDays} DAYS. EACH CHECKPOINT ASKS FOR EVIDENCE, NOT EFFORT.</Because>
              </Instrument>
            </Section>

            {blueprint.bosses.length > 0 && (
              <Section seq={seq++}>
                <Instrument label="BOSSES · SEALED">
                  <ul className="space-y-1.5">
                    {blueprint.bosses.map((boss) => (
                      <li key={boss.id} className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-100">{boss.title} <span className="text-faint">· DAYS {boss.windowStartDay}–{boss.windowEndDay}</span></li>
                    ))}
                  </ul>
                  <Because>BECAUSE: EACH ONE WAITS ON THE EVIDENCE YOUR DOMAINS COLLECT.</Because>
                </Instrument>
              </Section>
            )}

            {pinned && (
              <button type="button" onClick={onUnpin} className="min-h-[44px] w-full text-center font-mono text-[10px] uppercase tracking-[0.18em] text-faint underline">
                Release every pin
              </button>
            )}

            {errors.length > 0 && (
              <ul className="space-y-1" role="alert">
                {errors.map((error) => <li key={error} className="font-mono text-[11px] uppercase tracking-[0.12em] text-state-alert">{error}</li>)}
              </ul>
            )}
          </div>

          {failure && <p className="px-gutter pb-2 text-sm text-state-alert" role="alert">{failure}</p>}
          <div className="relative flex gap-3 px-gutter pt-2" style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 16px)' }}>
            <SecondaryButton onClick={onChange} disabled={busy} className="flex-[0_0_31%]">Change</SecondaryButton>
            <PrimaryButton size="md" disabled={busy || errors.length > 0} onClick={onActivate} className="flex-1">{busy ? 'Initialising…' : 'Initialise system'}</PrimaryButton>
          </div>
        </div>
      </div>

      <ArcSheet open={adjusting === 'arc'} days={blueprint.arc.lengthDays} onClose={() => setAdjusting(null)} onPin={(days) => { onPinArc(days); setAdjusting(null); }} />
      {target && (
        <DomainSheet
          key={target.key} adjustable={target} title={targetQuest?.designation ?? target.archetypeId} currentDesignation={targetQuest?.designation}
          onClose={() => setAdjusting(null)} onPin={(values) => { onPinDomain(target.key, values); setAdjusting(null); }}
        />
      )}
    </ScreenShell>
  );
}

function ArcSheet({ open, days, onClose, onPin }: { open: boolean; days: number; onClose: () => void; onPin: (days: number) => void }) {
  const [value, setValue] = useState<number | string>(days);
  const shown = typeof value === 'number' ? value : days;
  return (
    <Sheet open={open} onClose={onClose} title="ADJUST — THE ARC" footer={<PrimaryButton size="md" className="w-full" onClick={() => onPin(Math.min(365, Math.max(60, Math.round(shown))))}>Pin this length</PrimaryButton>}>
      <div className="space-y-3 p-4">
        <p className="text-sm text-ink-500">Between 60 and 365 days. A pinned length stays when you change your answers.</p>
        <NumberField label="Arc length in days" bounds={{ min: 60, max: 365, step: 1 }} value={value} onChange={setValue} />
      </div>
    </Sheet>
  );
}

function DomainSheet({ adjustable, title, currentDesignation, onClose, onPin }: {
  adjustable: Adjustable; title: string; currentDesignation: string | undefined; onClose: () => void;
  onPin: (values: { goodDay?: number; hardDay?: number; designation?: string }) => void;
}) {
  const [good, setGood] = useState<number | string>(adjustable.goodDay ?? '');
  const [hard, setHard] = useState<number | string>(adjustable.hardDay ?? '');
  const [designation, setDesignation] = useState<string>(currentDesignation && adjustable.designations.includes(currentDesignation) ? currentDesignation : (adjustable.designations[0] ?? ''));
  const bounds = adjustable.bounds;
  const goodNow = typeof good === 'number' ? clampPin(adjustable.archetypeId, good) : undefined;
  const hardNow = typeof hard === 'number' ? Math.min(clampPin(adjustable.archetypeId, hard), goodNow ?? Infinity) : undefined;
  return (
    <Sheet
      open onClose={onClose} title={`ADJUST — ${title}`}
      footer={<PrimaryButton size="md" className="w-full" onClick={() => onPin({ ...(goodNow !== undefined ? { goodDay: goodNow } : {}), ...(hardNow !== undefined ? { hardDay: hardNow } : {}), ...(designation ? { designation } : {}) })}>Pin these</PrimaryButton>}
    >
      <div className="space-y-4 p-4">
        {bounds && (
          <>
            <div>
              <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-700">ON A GOOD DAY · {bounds.noun}</p>
              <NumberField label={`Good day, in ${bounds.noun.toLowerCase()}`} bounds={bounds} value={good} onChange={setGood} />
            </div>
            <div>
              <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-700">ON A HARD DAY · {bounds.noun}</p>
              <NumberField label={`Hard day, in ${bounds.noun.toLowerCase()}`} bounds={{ min: 1, max: bounds.max, step: 1 }} value={hard} onChange={setHard} />
            </div>
          </>
        )}
        {adjustable.designations.length > 1 && (
          <div>
            <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-700">WHAT THE SYSTEM CALLS IT</p>
            <Cards options={adjustable.designations.map((value) => ({ value, label: value }))} selected={[designation]} multiple={false} onToggle={setDesignation} />
          </div>
        )}
        <p className="text-xs text-faint">Pinned values stay as they are when you change your answers. The System moves the rest around them.</p>
      </div>
    </Sheet>
  );
}
