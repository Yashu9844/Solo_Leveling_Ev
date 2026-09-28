import { SystemWindow, type SystemWindowTone } from '../kit';
import type { SystemMessage, SystemMessageContext } from '../../engine/systemVoice';

/**
 * The System speaking about *you*, at the top of Today.
 *
 * design/04-SYSTEM-MESSAGE-ENGINE.md §15. This is not a quote card and
 * must never become one: no quotation marks, no attribution, no centred
 * serif italic. It is a readout — a decree in capitals with the numbers
 * that justify it printed underneath, which is what stops the line from
 * reading as an assertion and makes it read as a measurement.
 *
 * It sits above the DAILY QUEST window deliberately. The System states
 * the condition first, then lists requirements; reversing that order
 * turns the line into a footnote on a checklist.
 *
 * All motion comes from SystemWindow's CSS arrival, so the reduced-motion
 * rules in index.css collapse it to a finished block with nothing hidden
 * and nothing to re-enable (§17).
 */

/**
 * Tone → frame colour.
 *
 * Deliberately conservative. design/00 §2.2 bans gold from every
 * daily-loop screen and §2.3 reserves red for BOSS surfaces, and Today is
 * the daily loop — so the only split here is amber for the states that
 * already own amber on this screen (the recovery card, the day-closed
 * banner). Everything else is the arc's blue. A System that changes
 * colour for emphasis is a System whose colours mean nothing.
 */
const TONE_FRAME: Partial<Record<SystemMessage['tone'], SystemWindowTone>> = {
  restraint: 'recover',
};

interface SystemTransmissionProps {
  message: SystemMessage;
  context: SystemMessageContext;
  /** The state the message was chosen for. Re-keys the arrival animation. */
  fingerprint: string;
  systemLine?: string | null;
}

export function SystemTransmission({
  message,
  context,
  fingerprint,
  systemLine,
}: SystemTransmissionProps) {
  const tone = TONE_FRAME[message.tone] ?? 'accent';
  const lit = message.tone === 'verdict' || message.tone === 'momentum';

  const isComplete = context.coreCompleted >= (context.coreTotal || 6) && context.coreTotal > 0;

  return (
    <div className="mb-3 space-y-2.5" data-testid="system-transmission">
      {/* Sleek 3-Column Core HUD Stat Dashboard */}
      <div className="grid grid-cols-3 gap-2">
        {/* Stat 1: DAY */}
        <div
          className="cut-sm flex flex-col items-center justify-center py-2 px-1 relative overflow-hidden"
          style={{
            background: 'linear-gradient(180deg, rgba(14, 28, 50, 0.9) 0%, rgba(7, 14, 26, 0.95) 100%)',
            border: '1px solid rgba(77, 163, 255, 0.4)',
            boxShadow: '0 0 14px rgba(77, 163, 255, 0.15)',
          }}
        >
          <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-accent-mid">
            DAY
          </span>
          <span className="font-mono text-xl font-black leading-none tabular-nums text-ink-100 mt-1">
            {String(context.arcDay).padStart(2, '0')}
          </span>
        </div>

        {/* Stat 2: TASKS CLEARED */}
        <div
          className="cut-sm flex flex-col items-center justify-center py-2 px-1 relative overflow-hidden"
          style={{
            background: isComplete
              ? 'linear-gradient(180deg, rgba(20, 55, 38, 0.9) 0%, rgba(8, 26, 18, 0.95) 100%)'
              : 'linear-gradient(180deg, rgba(14, 28, 50, 0.9) 0%, rgba(7, 14, 26, 0.95) 100%)',
            border: isComplete
              ? '1px solid rgba(52, 211, 153, 0.6)'
              : '1px solid rgba(77, 163, 255, 0.4)',
            boxShadow: isComplete
              ? '0 0 14px rgba(52, 211, 153, 0.25)'
              : '0 0 14px rgba(77, 163, 255, 0.15)',
          }}
        >
          <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-accent-mid">
            CLEARED
          </span>
          <div className="flex items-baseline gap-1 mt-1">
            <span
              className={[
                'font-mono text-xl font-black leading-none tabular-nums',
                isComplete ? 'text-emerald-400 glow-text' : 'text-ink-100',
              ].join(' ')}
            >
              {context.coreCompleted}
            </span>
            <span className="font-mono text-xs font-semibold text-ink-500">
              / {context.coreTotal || 6}
            </span>
            <span className="sr-only">CLEARED</span>
          </div>
        </div>

        {/* Stat 3: XP TODAY */}
        <div
          className="cut-sm flex flex-col items-center justify-center py-2 px-1 relative overflow-hidden"
          style={{
            background: 'linear-gradient(180deg, rgba(14, 28, 50, 0.9) 0%, rgba(7, 14, 26, 0.95) 100%)',
            border: '1px solid rgba(77, 163, 255, 0.4)',
            boxShadow: '0 0 14px rgba(77, 163, 255, 0.15)',
          }}
        >
          <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-accent-mid">
            XP TODAY
          </span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="font-mono text-xl font-black leading-none tabular-nums text-amber-400">
              {context.xpEarned}
            </span>
            <span className="font-mono text-xs font-semibold text-ink-500">
              / {context.xpTarget}
            </span>
            <span className="sr-only">XP</span>
          </div>
        </div>
      </div>

      {/* Single Clean System Transmission Panel */}
      <SystemWindow
        key={fingerprint}
        arrive
        tone={tone}
        label={`SYSTEM · ${message.label}`}
        className="cut-sm px-3.5 py-3"
      >
        <p
          role="status"
          className="font-display text-[15px] uppercase leading-[1.35] tracking-[0.055em] text-ink-100"
          style={lit ? { textShadow: 'var(--glow-text)' } : undefined}
        >
          {message.text}
        </p>

        {systemLine && (
          <p
            className="mt-2 text-xs italic leading-relaxed text-ink-400 border-t border-hair-faint pt-1.5"
            data-testid="system-line"
          >
            {systemLine}
          </p>
        )}
      </SystemWindow>
    </div>
  );
}
