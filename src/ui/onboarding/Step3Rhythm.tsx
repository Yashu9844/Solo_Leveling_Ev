import type { CSSProperties } from 'react';
import { ChipToggle } from '../components/ChipToggle';
import { EASE, Instrument, Rise, SlotField, StepConsole, SubHead, toMinutes } from './shared';

const TRAINING_DAY_OPTIONS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
const ATTENTION_APP_OPTIONS = ['Instagram', 'YouTube', 'X / Twitter', 'Reddit', 'TikTok'] as const;

const DAY_MINUTES = 1440;

function duration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/* ── the dial ─────────────────────────────────────────────────────── */

const SIZE = 168;
const R = 68;
const C = 2 * Math.PI * R;

/** Minutes past midnight → the angle a `rotate()` needs to put that
 * time at the top of the dial. SVG's 0° is 3 o'clock, so everything is
 * offset by a quarter turn. */
function angleAt(minutes: number): number {
  return (minutes / DAY_MINUTES) * 360 - 90;
}

/** A point on the dial's circle, for the two end markers. */
function pointAt(minutes: number, radius: number): { x: number; y: number } {
  const rad = (angleAt(minutes) * Math.PI) / 180;
  return { x: SIZE / 2 + radius * Math.cos(rad), y: SIZE / 2 + radius * Math.sin(rad) };
}

/**
 * The day, drawn as a 24-hour dial.
 *
 * A horizontal band was the obvious shape and it is the wrong one: this
 * app is built for someone who sleeps at 02:00, so their waking stretch
 * wraps past midnight, and a band has to cut that in two and draw it at
 * both ends of the screen. A circle has no ends — the wrap is simply an
 * arc that crosses the top, which is also how anyone actually pictures
 * a day.
 *
 * The figure in the middle is the one piece of news on this screen. A
 * stated 08:30–02:00 is seventeen and a half hours awake, and seeing
 * that number is the moment the rest of the app's demands stop sounding
 * unreasonable.
 */
function DayDial({ wakeTime, sleepTime }: { wakeTime: string; sleepTime: string }) {
  const wake = toMinutes(wakeTime);
  const sleep = toMinutes(sleepTime);
  const ready = wake !== null && sleep !== null && wake !== sleep;
  const awake = ready ? (sleep - wake + DAY_MINUTES) % DAY_MINUTES : 0;

  const wakePt = pointAt(ready ? wake : 0, R);
  const sleepPt = pointAt(ready ? sleep : 0, R);

  return (
    <div className="relative mx-auto" style={{ width: SIZE, height: SIZE }}>
      <svg
        aria-hidden
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="absolute inset-0 h-full w-full"
        style={{ overflow: 'visible' }}
      >
        <defs>
          <linearGradient id="dial-awake" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--accent-deep)" />
            <stop offset="55%" stopColor="var(--accent)" />
            <stop offset="100%" stopColor="var(--accent-core)" />
          </linearGradient>
        </defs>

        {/* The unlit ring — the hours that are not yours. */}
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={R}
          fill="none"
          stroke="color-mix(in srgb, var(--void) 55%, var(--surface-2))"
          strokeWidth={11}
        />

        {/* Hour gradations. Every hour, longer on the quarters. */}
        {Array.from({ length: 24 }, (_, h) => {
          const major = h % 6 === 0;
          const a = (angleAt(h * 60) * Math.PI) / 180;
          const inner = R - (major ? 9 : 5.5);
          const outer = R + (major ? 9 : 5.5);
          return (
            <line
              key={h}
              x1={SIZE / 2 + inner * Math.cos(a)}
              y1={SIZE / 2 + inner * Math.sin(a)}
              x2={SIZE / 2 + outer * Math.cos(a)}
              y2={SIZE / 2 + outer * Math.sin(a)}
              stroke={major ? 'var(--hair-strong)' : 'var(--hair-faint)'}
              strokeWidth={major ? 1.5 : 1}
            />
          );
        })}

        {/* The waking arc. One stroked circle, dashed to the right
            length and rotated to start at the wake time — which is what
            makes the midnight wrap free rather than a special case. */}
        {ready && (
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={R}
            fill="none"
            stroke="url(#dial-awake)"
            strokeWidth={11}
            strokeLinecap="butt"
            strokeDasharray={`${(awake / DAY_MINUTES) * C} ${C}`}
            transform={`rotate(${angleAt(wake)} ${SIZE / 2} ${SIZE / 2})`}
            style={{
              filter: 'drop-shadow(0 0 7px color-mix(in srgb, var(--accent) 65%, transparent))',
              animation: `init-hero-in 560ms ${EASE} both`,
            }}
          />
        )}

        {/* The two ends, so the arc has a beginning and a stop rather
            than fading into the ring. */}
        {ready && (
          <>
            <circle cx={wakePt.x} cy={wakePt.y} r={4.5} fill="var(--accent-core)" />
            <circle
              cx={sleepPt.x}
              cy={sleepPt.y}
              r={4.5}
              fill="var(--void)"
              stroke="var(--accent)"
              strokeWidth={1.5}
            />
          </>
        )}
      </svg>

      {/* The hour labels, outside the ring. Four is enough to orient;
          twenty-four would be a clock face nobody asked for. */}
      {[0, 6, 12, 18].map((h) => {
        const p = pointAt(h * 60, R + 21);
        return (
          <span
            key={h}
            aria-hidden
            className="absolute font-mono text-[9px] tabular-nums text-faint"
            style={{ left: p.x, top: p.y, transform: 'translate(-50%, -50%)' }}
          >
            {String(h).padStart(2, '0')}
          </span>
        );
      })}

      {/* The figure, in the hole in the middle. */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          key={awake}
          className="font-mono font-bold tabular-nums leading-none text-accent-core"
          style={{
            // The inner hole is 125px across. "17h 30m" at 26px nearly
            // fills it edge to edge and reads as though it is about to
            // collide with the ring; 22px leaves the figure sitting in
            // the dial rather than jammed into it.
            fontSize: 'calc(22px * var(--type-scale))',
            textShadow: 'var(--glow-text)',
            animation: `init-hero-in 420ms ${EASE} both`,
          }}
        >
          {ready ? duration(awake) : '—'}
        </span>
        <span className="mt-1.5 font-mono text-[9px] font-bold uppercase tracking-[0.22em] text-ink-700">
          awake
        </span>
      </div>
    </div>
  );
}

/* ── the gauge ────────────────────────────────────────────────────── */

/**
 * A continuous quantity, set by dragging.
 *
 * The shared `Stepper` is right for a figure you nudge and wrong for
 * one that ranges over 20000 in steps of 500 — that is sixteen taps to
 * cross the useful range. This is onboarding-local on purpose: the
 * `Stepper` is used on six other screens and none of them are asking
 * this question.
 */
function Gauge({
  label,
  value,
  min,
  max,
  step,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix?: string;
  onChange: (v: number) => void;
}) {
  // The webkit track paints its own fill from this, because
  // `::-webkit-slider-runnable-track` has no progress pseudo-element the
  // way Firefox does.
  const fill = max > min ? ((value - min) / (max - min)) * 100 : 0;

  return (
    <div>
      <div className="mb-2 flex items-baseline gap-3">
        <span className="min-w-0 truncate font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-ink-700">
          {label}
        </span>
        <span
          aria-hidden
          className="h-px min-w-[10px] flex-1"
          style={{ background: 'var(--hair-faint)' }}
        />
        <span className="shrink-0 font-mono text-md font-bold tabular-nums text-accent-mid">
          {value.toLocaleString('en-GB')}
          {suffix && (
            <span className="ml-1 text-[10px] font-bold uppercase tracking-[0.18em] text-ink-700">
              {suffix}
            </span>
          )}
        </span>
      </div>
      <div className="flex min-h-tap items-center">
        <input
          type="range"
          className="init-gauge"
          value={value}
          min={min}
          max={max}
          step={step}
          aria-label={label}
          onChange={(e) => onChange(Number(e.target.value))}
          style={{ '--fill': `${fill}%` } as CSSProperties}
        />
      </div>
    </div>
  );
}

export function Step3Rhythm({
  wakeTime,
  sleepTime,
  trainingDays,
  stepsTarget,
  screenCapMinutes,
  attentionApps,
  onChangeWake,
  onChangeSleep,
  onChangeTrainingDays,
  onChangeStepsTarget,
  onChangeScreenCap,
  onChangeAttentionApps,
}: {
  wakeTime: string;
  sleepTime: string;
  trainingDays: string[];
  stepsTarget: number;
  screenCapMinutes: number;
  attentionApps: string[];
  onChangeWake: (v: string) => void;
  onChangeSleep: (v: string) => void;
  onChangeTrainingDays: (v: string[]) => void;
  onChangeStepsTarget: (v: number) => void;
  onChangeScreenCap: (v: number) => void;
  onChangeAttentionApps: (v: string[]) => void;
}) {
  return (
    <StepConsole
      index={3}
      kicker="Calibrate the day"
      title="Rhythm"
      lead="The shape of an ordinary day, so the System knows what it is asking of you."
    >
      <div className="space-y-6">
        {/* ── the waking window ── */}
        <Rise delay={60} className="space-y-4">
          <SubHead>Waking window</SubHead>

          {/* Stacked until 360px, for the same reason ARC's dates are:
              a 12-hour locale renders "08:30 AM" plus a clock glyph the
              control draws itself, and half of a 320px column clips the
              meridiem — leaving a time that reads as either morning or
              night on the one screen whose whole subject is which. */}
          <div className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2">
            <SlotField label="Wake">
              <input
                type="time"
                value={wakeTime}
                onChange={(e) => onChangeWake(e.target.value)}
                className="tabular-nums"
              />
            </SlotField>
            <SlotField label="Sleep">
              <input
                type="time"
                value={sleepTime}
                onChange={(e) => onChangeSleep(e.target.value)}
                className="tabular-nums"
              />
            </SlotField>
          </div>

          <Instrument label="Day cycle" live>
            <DayDial wakeTime={wakeTime} sleepTime={sleepTime} />
            <p className="mt-2 text-center text-xs text-faint">Day closes at 03:00.</p>
          </Instrument>
        </Rise>

        {/* ── the body's week ── */}
        <Rise delay={120} className="space-y-4">
          <SubHead
            right={
              <span className="shrink-0 font-mono text-[10px] font-bold tabular-nums text-accent-mid">
                {trainingDays.length}
                <span className="text-faint"> / 7</span>
              </span>
            }
          >
            Load
          </SubHead>

          <ChipToggle
            label="Training days"
            options={TRAINING_DAY_OPTIONS}
            selected={trainingDays}
            onChange={onChangeTrainingDays}
            columns={4}
          />

          <Gauge
            label="Steps target"
            value={stepsTarget}
            min={0}
            max={20000}
            step={500}
            onChange={onChangeStepsTarget}
          />
        </Rise>

        {/* ── what is taking the day back ── */}
        <Rise delay={180} className="space-y-4">
          <SubHead>Attention</SubHead>

          <Gauge
            label="Screen cap"
            value={screenCapMinutes}
            min={0}
            max={240}
            step={5}
            suffix="min"
            onChange={onChangeScreenCap}
          />

          <ChipToggle
            label="Apps to watch"
            options={ATTENTION_APP_OPTIONS}
            selected={attentionApps}
            onChange={onChangeAttentionApps}
          />
        </Rise>
      </div>
    </StepConsole>
  );
}
