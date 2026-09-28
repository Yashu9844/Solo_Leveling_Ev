import { Barbell, Briefcase, Code, type Icon } from '@phosphor-icons/react';
import type { CSSProperties, ReactNode } from 'react';
import { IconTile } from '../kit';
import { EASE, Instrument, Rise, Slot, StepConsole, type IntentionDraft } from './shared';

/**
 * Step 5 — implementation intentions.
 *
 * `final/06` §5.1 marks this step THE IMPORTANT ONE, and the effect
 * behind it is the strongest single lever in the whole product: a plan
 * naming a time, a place and a first action is acted on far more often
 * than an equally sincere intention that names none of them.
 *
 * So the design's whole job here is to stop this reading as nine more
 * fields. Each trigger is a device that is either drafted or **armed**,
 * it says which in four separate ways — the housing's luminance, its
 * edge light, a glyph and the word itself — and the step keeps a three
 * segment meter at the top. Someone who leaves this screen with 1/3
 * armed has been told four times.
 */
function armed(i: IntentionDraft): boolean {
  return i.place.trim().length > 0 && i.first_action.trim().length > 0;
}

/**
 * Nine fields on one step, at the kit's 48px form height and 17px body,
 * is eleven hundred pixels of scrolling — and this is the step that
 * matters most, so it is the worst one to make people scroll through.
 *
 * 44px is the real floor (`final/06` §7) rather than the kit's
 * comfortable 48, and these are three-word answers, not prose. Both
 * still scale with the text-size setting, so XL is unaffected.
 */
const CARD_SLOT: CSSProperties = {
  // 46, not 44: the slot's 1px border top and bottom come out of the
  // control's own box, so a 44px housing leaves a 42px input and the
  // field misses the floor by the width of its own frame.
  minHeight: 46,
};

/** The time is four characters and a picker glyph. Letting it stretch
 * across the row made a fixed fact look like an open question. */
const TIME_SLOT: CSSProperties = { ...CARD_SLOT, width: 142, flex: '0 0 auto' };

/** One clause of the sentence, with the connecting word on a fixed
 * column so the three fields align into something you read downward.
 *
 * Wrapping the sentence inline looked better on paper and failed on a
 * phone: the time picker eats most of the row, squeezing "my desk" down
 * to "my d" at 390px, and at 320px the word "at" wraps and is orphaned
 * at the end of a line. */
function Row({ word, children }: { word: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-12 shrink-0 font-mono text-[11px] tracking-[0.04em] text-ink-700">
        {word}
      </span>
      {children}
    </div>
  );
}

/**
 * The armed meter.
 *
 * Three segments rather than a "0 / 3" alone: a count is a fact you
 * read, and a bank of segments with two of three lit is a state you
 * see. The step is the one people abandon halfway, so the cost of
 * leaving has to be visible without being read.
 */
function ArmedMeter({ count }: { count: number }) {
  return (
    <Instrument
      label="Armed"
      live={count === 3}
      right={
        <span
          className="shrink-0 font-mono text-[11px] font-bold tabular-nums"
          style={{ color: count === 3 ? 'var(--accent-core)' : 'var(--ink-700)' }}
        >
          {count}
          <span className="text-faint"> / 3</span>
        </span>
      }
    >
      <div className="flex gap-1.5">
        {[0, 1, 2].map((i) => {
          const lit = i < count;
          return (
            <span
              key={i}
              aria-hidden
              className="h-[5px] min-w-0 flex-1 overflow-hidden rounded-pill"
              style={{
                background: 'color-mix(in srgb, var(--void) 70%, var(--surface-2))',
                boxShadow: 'inset 0 1px 2px #000',
              }}
            >
              <span
                className="block h-full w-full origin-left rounded-pill"
                style={{
                  background: lit
                    ? 'linear-gradient(to right, var(--accent-deep), var(--accent-core))'
                    : 'transparent',
                  boxShadow: lit ? 'var(--glow-sm)' : 'none',
                  transform: lit ? 'scaleX(1)' : 'scaleX(0)',
                  transition: `transform 320ms ${EASE}`,
                }}
              />
            </span>
          );
        })}
      </div>
    </Instrument>
  );
}

function TriggerCard({
  label,
  icon,
  testId,
  placeholderPlace,
  placeholderAction,
  value,
  onChange,
  delay,
}: {
  label: string;
  icon: Icon;
  testId: string;
  placeholderPlace: string;
  placeholderAction: string;
  value: IntentionDraft;
  onChange: (patch: Partial<IntentionDraft>) => void;
  delay: number;
}) {
  const isArmed = armed(value);

  return (
    <Rise delay={delay}>
      <div
        data-testid={testId}
        className="cut-sm relative overflow-hidden"
        style={
          {
            '--cut-sm': '10px',
            // Armed rises out of the panel; draft sits recessed into
            // it. The luminance flip is the part that reads from the
            // corner of the eye, before any glyph or word does.
            background: isArmed
              ? 'linear-gradient(180deg, color-mix(in srgb, var(--accent) 12%, transparent), transparent 58%), var(--surface)'
              : 'linear-gradient(180deg, color-mix(in srgb, var(--void) 55%, var(--surface)) 0%, color-mix(in srgb, var(--void) 24%, var(--surface)) 100%)',
            border: `1px solid ${isArmed ? 'var(--accent)' : 'var(--hair-faint)'}`,
            boxShadow: isArmed
              ? '0 0 18px color-mix(in srgb, var(--accent) 22%, transparent)'
              : 'inset 0 12px 20px -16px #000',
            transition: `border-color 220ms ${EASE}, box-shadow 220ms ${EASE}, background 220ms ${EASE}`,
          } as CSSProperties
        }
      >
        {/* The spine down the left edge: lit when armed, hairline when
            not. A state readable from the corner of the eye while a
            thumb is in a field two rows below it. */}
        <span
          aria-hidden
          className="absolute inset-y-0 left-0 w-[2px]"
          style={{
            background: isArmed
              ? 'linear-gradient(180deg, var(--accent-core), var(--accent-deep))'
              : 'var(--hair-faint)',
            transition: `background 220ms ${EASE}`,
          }}
        />

        <div className="space-y-2.5 p-3.5 pl-[16px]">
          <div className="flex items-center gap-2.5">
            <IconTile icon={icon} size={30} active={isArmed} />
            <span className="min-w-0 flex-1 truncate font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-ink-300">
              {label}
            </span>
            <span
              className="shrink-0 font-mono text-[9px] font-bold uppercase tracking-[0.18em]"
              style={{ color: isArmed ? 'var(--accent-mid)' : 'var(--faint)' }}
            >
              {isArmed ? '◆ Armed' : '◇ Draft'}
            </span>
          </div>

          <Row word="At">
            <Slot className="px-2" style={TIME_SLOT}>
              <input
                type="time"
                value={value.time}
                onChange={(e) => onChange({ time: e.target.value })}
                className="tabular-nums"
              />
            </Slot>
          </Row>
          <Row word="at">
            <Slot className="min-w-0 flex-1 px-2" style={CARD_SLOT}>
              <input
                type="text"
                value={value.place}
                onChange={(e) => onChange({ place: e.target.value })}
                placeholder={placeholderPlace}
                data-testid={`${testId}-place`}
              />
            </Slot>
          </Row>
          <Row word="I will">
            <Slot className="min-w-0 flex-1 px-2" style={CARD_SLOT}>
              <input
                type="text"
                value={value.first_action}
                onChange={(e) => onChange({ first_action: e.target.value })}
                placeholder={placeholderAction}
                data-testid={`${testId}-action`}
              />
            </Slot>
          </Row>

          {/* The assembled trigger, printed the way the alarm will read
              it tomorrow morning. It appears only once it is real. */}
          {isArmed && (
            <div
              aria-hidden
              className="flex min-w-0 items-center gap-2 rounded-sm px-2.5 py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-accent-mid"
              style={{
                background: 'var(--fill-faint)',
                border: '1px solid var(--hair-faint)',
                animation: `init-arm 700ms ${EASE} both`,
              }}
            >
              <span className="shrink-0 tabular-nums">{value.time}</span>
              <span className="shrink-0 opacity-40">·</span>
              <span className="min-w-0 truncate">{value.first_action.trim()}</span>
            </div>
          )}
        </div>
      </div>
    </Rise>
  );
}

export function Step5Triggers({
  career,
  dsa,
  training,
  onChangeCareer,
  onChangeDsa,
  onChangeTraining,
}: {
  career: IntentionDraft;
  dsa: IntentionDraft;
  training: IntentionDraft;
  onChangeCareer: (patch: Partial<IntentionDraft>) => void;
  onChangeDsa: (patch: Partial<IntentionDraft>) => void;
  onChangeTraining: (patch: Partial<IntentionDraft>) => void;
}) {
  const count = [career, dsa, training].filter(armed).length;

  return (
    <StepConsole
      index={5}
      kicker="Trigger protocol"
      title="When and where"
      lead="Finish these. They matter more than any other setting here."
    >
      <div className="space-y-4">
        <Rise delay={50}>
          <ArmedMeter count={count} />
        </Rise>

        <TriggerCard
          label="Career"
          icon={Briefcase}
          testId="career-intention"
          placeholderPlace="my desk"
          placeholderAction="open the job board before anything"
          value={career}
          onChange={onChangeCareer}
          delay={90}
        />
        <TriggerCard
          label="DSA"
          icon={Code}
          testId="dsa-intention"
          placeholderPlace="my desk"
          placeholderAction="open the editor"
          value={dsa}
          onChange={onChangeDsa}
          delay={140}
        />
        <TriggerCard
          label="Training"
          icon={Barbell}
          testId="training-intention"
          placeholderPlace="the gym"
          placeholderAction="change & start"
          value={training}
          onChange={onChangeTraining}
          delay={190}
        />
      </div>
    </StepConsole>
  );
}
