import { useId, type ReactNode } from 'react';
import type { Answers } from '../../../onboarding/engine';
import { STAGES, type OptionDef, type QuestionInstance } from '../../../onboarding/types';
import { DayDial } from '../Step3Rhythm';
import { EASE, HeroFigure, Instrument, Rise, Slot, SlotField, StepConsole } from '../shared';
import { STAGE_COPY } from './stages';

export interface QuestionViewProps {
  instance: QuestionInstance;
  options: OptionDef[];
  answers: Answers;
  /** The value being edited: the stored answer, or the question's default. */
  value: unknown;
  onChange: (value: unknown) => void;
  /** Why the last answer was refused, in plain words. */
  error?: string | null;
}

const asString = (value: unknown): string => (typeof value === 'string' ? value : '');
const asList = (value: unknown): string[] => (Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []);

/** One question, rendered from its definition: the same console for every kind, with the hero the question calls for. */
export function QuestionView({ instance, options, answers, value, onChange, error }: QuestionViewProps) {
  const { def } = instance;
  const copy = STAGE_COPY[def.stage];
  const lead = def.subline;
  return (
    <StepConsole index={STAGES.indexOf(def.stage) + 1} kicker={copy.kicker} title={instance.heading} lead={lead}>
      <div className="space-y-4" data-testid={`question-${instance.key}`}>
        <Hero instance={instance} answers={answers} value={value} />
        <Control instance={instance} options={options} value={value} onChange={onChange} />
        {error && (
          <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-state-alert" role="alert">
            {error}
          </p>
        )}
      </div>
    </StepConsole>
  );
}

// ── The hero: the one figure a question is about ────────────────────────────

function Hero({ instance, answers, value }: { instance: QuestionInstance; answers: Answers; value: unknown }) {
  const { def } = instance;
  if (def.kind === 'dial') {
    const isWake = instance.writes === 'rhythm.wakeTime';
    const wake = isWake ? asString(value) : asString(answers['rhythm.wakeTime']) || '07:00';
    const sleep = isWake ? asString(answers['rhythm.sleepTime']) || '23:00' : asString(value);
    return <DayDial wakeTime={wake} sleepTime={sleep} />;
  }
  if (def.kind === 'number') {
    return (
      <Instrument>
        <HeroFigure value={typeof value === 'number' ? value : '—'} unit={def.unit ?? ''} />
      </Instrument>
    );
  }
  if (def.stage === 'TRIGGERS' && instance.area) return <IfThenHero instance={instance} answers={answers} value={value} />;
  return null;
}

/** "AT 07:30 · AT THE DESK · I WILL OPEN THE QUESTION BANK", filled in as each part is given. */
function IfThenHero({ instance, answers, value }: { instance: QuestionInstance; answers: Answers; value: unknown }) {
  const part = (id: string): string => {
    const path = `area.${instance.area}.${id}`;
    return asString(path === instance.writes ? value : answers[path]).replace('__skipped__', '');
  };
  const time = part('triggerTime');
  const place = part('triggerPlace');
  const action = part('triggerAction');
  return (
    <Instrument label="IF · THEN" live>
      <div className="space-y-1 font-mono text-[12px] uppercase tracking-[0.12em]">
        <Line word="AT" text={time} blank="HH:MM" />
        <Line word="AT" text={place} blank="WHERE" />
        <Line word="I WILL" text={action} blank="THE FIRST THING" />
      </div>
    </Instrument>
  );
}

function Line({ word, text, blank }: { word: string; text: string; blank: string }) {
  return (
    <div className="flex min-w-0 gap-2" style={{ color: text ? 'var(--accent-mid)' : 'var(--faint)' }}>
      <span className="w-14 shrink-0 opacity-60">{word}</span>
      <span className="min-w-0 truncate">{text || blank}</span>
    </div>
  );
}

// ── The control ─────────────────────────────────────────────────────────────

function Control({ instance, options, value, onChange }: Pick<QuestionViewProps, 'instance' | 'options' | 'value' | 'onChange'>) {
  const { def } = instance;
  switch (def.kind) {
    case 'single_card':
    case 'action_card':
      return <Cards options={options} selected={asString(value) ? [asString(value)] : []} multiple={false} onToggle={(option) => onChange(option)} />;
    case 'multi_card': {
      const selected = asList(value);
      const max = def.count?.max;
      return (
        <Cards
          options={options}
          selected={selected}
          multiple
          onToggle={(option) => {
            if (selected.includes(option)) onChange(selected.filter((item) => item !== option));
            else if (max === undefined || selected.length < max) onChange([...selected, option]);
          }}
          footer={`${selected.length}${def.count?.max ? ` / ${def.count.max}` : ''} CHOSEN${def.count?.min ? ` · AT LEAST ${def.count.min}` : ''}`}
        />
      );
    }
    case 'rank':
      return <RankList options={options} order={asList(value)} onChange={onChange} />;
    case 'number':
      return <NumberControl instance={instance} value={value} onChange={onChange} />;
    case 'time':
    case 'dial':
      return (
        <SlotField label={def.kind === 'dial' ? 'TIME' : 'TIME OF DAY'}>
          <input type="time" value={asString(value)} onChange={(event) => onChange(event.target.value)} className="tabular-nums" data-testid="answer" />
        </SlotField>
      );
    case 'date':
      return (
        <SlotField label="DATE">
          <input type="date" value={asString(value)} onChange={(event) => onChange(event.target.value)} className="tabular-nums" data-testid="answer" />
        </SlotField>
      );
    case 'text_short':
      return (
        <SlotField label="ANSWER">
          <input
            type="text" value={asString(value)} onChange={(event) => onChange(event.target.value)} maxLength={def.bounds?.maxLength ?? 80}
            autoComplete={instance.writes === 'identity.displayName' ? 'given-name' : 'off'} autoCapitalize="sentences" data-testid="answer"
          />
        </SlotField>
      );
  }
}

/** Cards you tap. One tap selects (single) or toggles (multi); the state has a shape as well as a colour (a filled node against an empty one). */
function Cards({ options, selected, multiple, onToggle, footer }: { options: OptionDef[]; selected: string[]; multiple: boolean; onToggle: (value: string) => void; footer?: ReactNode }) {
  return (
    <div>
      <div role={multiple ? 'group' : 'radiogroup'} className="grid gap-2">
        {options.map((option, index) => {
          const on = selected.includes(option.value);
          return (
            <Rise key={option.value} delay={index * 30}>
              <button
                type="button" role={multiple ? 'checkbox' : 'radio'} aria-checked={on} onClick={() => onToggle(option.value)} data-value={option.value}
                className="cut-sm relative flex min-h-[56px] w-full items-center gap-3 px-3.5 py-2.5 text-left"
                style={{
                  background: on ? 'linear-gradient(180deg, color-mix(in srgb, var(--accent) 14%, transparent), transparent 70%), var(--surface)' : 'color-mix(in srgb, var(--void) 40%, var(--surface))',
                  border: `1px solid ${on ? 'var(--accent)' : 'var(--hair-faint)'}`,
                  boxShadow: on ? '0 0 16px color-mix(in srgb, var(--accent) 22%, transparent)' : 'inset 0 10px 18px -14px #000',
                  transition: `border-color 200ms ${EASE}, box-shadow 200ms ${EASE}`,
                }}
              >
                <span aria-hidden className="block h-[9px] w-[9px] shrink-0 rotate-45" style={{ background: on ? 'var(--accent-core)' : 'transparent', border: `1px solid ${on ? 'var(--accent)' : 'var(--hair)'}` }} />
                <span className="min-w-0 flex-1">
                  <span className="block font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-ink-100">{option.label}</span>
                  {option.hint && <span className="mt-0.5 block text-xs leading-snug text-ink-500">{option.hint}</span>}
                </span>
              </button>
            </Rise>
          );
        })}
      </div>
      {footer && <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.18em] text-faint">{footer}</p>}
    </div>
  );
}

/** Ranking by moving: up and down on each row. A drag handle is not reachable by keyboard or screen reader; two buttons are. */
function RankList({ options, order, onChange }: { options: OptionDef[]; order: string[]; onChange: (value: string[]) => void }) {
  const labelOf = (value: string) => options.find((option) => option.value === value)?.label ?? value;
  const move = (from: number, to: number) => {
    if (to < 0 || to >= order.length) return;
    const next = [...order];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item!);
    onChange(next);
  };
  return (
    <ol className="space-y-2" aria-label="Priority order, first is most important">
      {order.map((value, index) => (
        <li key={value} className="cut-sm flex min-h-[52px] items-center gap-3 px-3" style={{ border: '1px solid var(--hair-faint)', background: 'color-mix(in srgb, var(--void) 40%, var(--surface))' }}>
          <span className="w-6 shrink-0 font-mono text-[12px] font-bold tabular-nums text-accent-mid">{String(index + 1).padStart(2, '0')}</span>
          <span className="min-w-0 flex-1 truncate font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-ink-100">{labelOf(value)}</span>
          <MoveButton label={`Move ${labelOf(value)} up`} disabled={index === 0} onClick={() => move(index, index - 1)} glyph="▲" />
          <MoveButton label={`Move ${labelOf(value)} down`} disabled={index === order.length - 1} onClick={() => move(index, index + 1)} glyph="▼" />
        </li>
      ))}
    </ol>
  );
}

function MoveButton({ label, disabled, onClick, glyph }: { label: string; disabled: boolean; onClick: () => void; glyph: string }) {
  return (
    <button type="button" aria-label={label} disabled={disabled} onClick={onClick} className="flex h-11 w-11 shrink-0 items-center justify-center font-mono text-[12px] text-accent-mid disabled:opacity-25">
      <span aria-hidden>{glyph}</span>
    </button>
  );
}

/** A number: the figure above is the answer; here are − and + at the question's own step, and the keyboard for anything else. */
function NumberControl({ instance, value, onChange }: { instance: QuestionInstance; value: unknown; onChange: (value: number | string) => void }) {
  const id = useId();
  const { min = 0, max = Number.MAX_SAFE_INTEGER, step = 1 } = instance.def.bounds ?? {};
  const current = typeof value === 'number' ? value : Number(value);
  const known = Number.isFinite(current);
  const nudge = (direction: 1 | -1) => onChange(Math.min(max, Math.max(min, (known ? current : min) + direction * step)));
  return (
    <div className="flex items-end gap-2">
      <StepButton label="Decrease" glyph="−" disabled={known && current <= min} onClick={() => nudge(-1)} />
      <label htmlFor={id} className="min-w-0 flex-1">
        <span className="sr-only">{instance.heading}</span>
        <Slot>
          <input
            id={id} type="number" inputMode="decimal" min={min} max={Number.isFinite(max) ? max : undefined} step={step} value={known ? current : ''}
            onChange={(event) => onChange(event.target.value === '' ? '' : Number(event.target.value))} className="tabular-nums" data-testid="answer"
          />
        </Slot>
      </label>
      <StepButton label="Increase" glyph="+" disabled={known && current >= max} onClick={() => nudge(1)} />
    </div>
  );
}

function StepButton({ label, glyph, disabled, onClick }: { label: string; glyph: string; disabled: boolean; onClick: () => void }) {
  return (
    <button type="button" aria-label={label} disabled={disabled} onClick={onClick} className="init-slot flex h-12 w-12 shrink-0 items-center justify-center font-mono text-lg text-accent-mid disabled:opacity-30">
      <span aria-hidden>{glyph}</span>
    </button>
  );
}

