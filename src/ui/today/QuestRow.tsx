import { useEffect, useRef, useState } from 'react';
import { motion, useMotionValue, useTransform } from 'framer-motion';
import {
  Barbell,
  Briefcase,
  CaretDoubleRight,
  Check,
  Code,
  Cpu,
  Eye,
  MoonStars,
  ArrowUUpLeft,
  type Icon,
} from '@phosphor-icons/react';
import type { CoreQuestKey, QuestInstance, QuestTemplate } from '../../engine/types';
import { ROW_SUMMARY } from './criterionText';

/** One glyph per domain, so a row is recognisable before it is read. */
const QUEST_ICON: Record<CoreQuestKey, Icon> = {
  career: Briefcase,
  dsa: Code,
  build: Cpu,
  training: Barbell,
  sleep: MoonStars,
  attention: Eye,
};

/** Tile color scheme for domain icon box matching reference design */
const DOMAIN_THEME: Record<CoreQuestKey, { bg: string; border: string; color: string; glow: string }> = {
  attention: {
    bg: 'rgba(15, 45, 85, 0.65)',
    border: 'rgba(77, 163, 255, 0.45)',
    color: '#5fb2ff',
    glow: '0 0 10px rgba(77, 163, 255, 0.35)',
  },
  build: {
    bg: 'rgba(15, 45, 85, 0.65)',
    border: 'rgba(77, 163, 255, 0.45)',
    color: '#5fb2ff',
    glow: '0 0 10px rgba(77, 163, 255, 0.35)',
  },
  career: {
    bg: 'rgba(55, 20, 85, 0.65)',
    border: 'rgba(192, 132, 252, 0.45)',
    color: '#c084fc',
    glow: '0 0 10px rgba(192, 132, 252, 0.35)',
  },
  dsa: {
    bg: 'rgba(55, 20, 85, 0.65)',
    border: 'rgba(192, 132, 252, 0.45)',
    color: '#c084fc',
    glow: '0 0 10px rgba(192, 132, 252, 0.35)',
  },
  sleep: {
    bg: 'rgba(55, 20, 85, 0.65)',
    border: 'rgba(192, 132, 252, 0.45)',
    color: '#c084fc',
    glow: '0 0 10px rgba(192, 132, 252, 0.35)',
  },
  training: {
    bg: 'rgba(55, 20, 85, 0.65)',
    border: 'rgba(192, 132, 252, 0.45)',
    color: '#c084fc',
    glow: '0 0 10px rgba(192, 132, 252, 0.35)',
  },
};

/**
 * How far the card has to travel before the System accepts the gesture.
 *
 * Far enough that a thumb drifting during a vertical scroll cannot fire
 * it, short enough to reach without repositioning your grip on a 320px
 * screen. The row is ~52px tall, so this is roughly one and a half row
 * heights of travel.
 */
const COMMIT_DISTANCE = 84;

/** A flick this fast commits even if it never reached the distance —
 * how a confident swipe actually behaves. */
const COMMIT_VELOCITY = 520;

/** Past this much movement, the pointer-up is a drag and not a tap, so
 * the row must not also open its detail sheet. */
const DRAG_SLOP = 8;

interface QuestRowProps {
  template: QuestTemplate;
  instance: QuestInstance;
  dayClosed: boolean;
  /** Actual XP granted for a completed instance (may be capped below
   * template.xp) — omitted while incomplete, where the row shows the
   * template's nominal value instead. */
  xp?: { amount: number; cappedFrom?: number };
  onToggle: () => void;
  onOpen: () => void;
}

/**
 * A quest row you can swipe.
 *
 * Swipe right to complete, swipe left to undo. The card slides and
 * reveals the System's verdict underneath it — ⟨ COMPLETE ⟩ in the
 * domain's own light, ⟨ UNDO ⟩ in a quieter one — and a short haptic
 * fires the instant the gesture is far enough to count, so the commit
 * point is felt before the thumb lifts rather than discovered after.
 *
 * The direction is never ambiguous: an incomplete row only drags right
 * and a complete one only drags left. There is no gesture that could
 * mean two things.
 *
 * The 44px completion button stays exactly where it was, and that is
 * deliberate rather than timid. A swipe is invisible to a screen
 * reader, unreachable from a keyboard, and undiscoverable to anyone who
 * has never been told it exists; making it the only way to complete a
 * quest would lock those people out of the app's core loop. The gesture
 * is the fast path for the thumb that knows, the button is the one that
 * always works, and both run the same handler.
 *
 * Dragging is the one thing framer-motion is still trusted with here
 * (design/00 §5.1, and the same reasoning as `Sheet`): it only moves
 * something while a finger is on it, and releasing always resolves to a
 * known state, so a starved frame budget cannot strand the row
 * half-open the way a JS entrance animation can strand a screen.
 */
export function QuestRow({ template, instance, dayClosed, xp, onToggle, onOpen }: QuestRowProps) {
  const complete = instance.state === 'complete';
  const disabled = dayClosed;
  const displayedXp = complete ? (xp?.amount ?? template.xp) : template.xp;
  const capped = complete && xp?.cappedFrom !== undefined;
  const key = template.key as CoreQuestKey;
  const Glyph = QUEST_ICON[key] ?? Code;
  const theme = DOMAIN_THEME[key] ?? DOMAIN_THEME.attention;

  const x = useMotionValue(0);
  /** True once this drag has passed the slop, so the release is not
   * also treated as a tap on the row body. */
  const dragged = useRef(false);
  /** Latches at the commit point so the haptic fires once per crossing,
   * not on every pointer move past it. */
  const armed = useRef(false);
  const [showFloat, setShowFloat] = useState(false);
  const prevComplete = useRef(complete);

  useEffect(() => {
    // Read and update the ref before the early return. Previously the
    // assignment sat after it, so on a false -> true transition the ref
    // was never actually set to true and only stayed correct because
    // the next toggle happened to reset it.
    const wasComplete = prevComplete.current;
    prevComplete.current = complete;
    if (wasComplete || !complete) return;

    setShowFloat(true);
    const timer = setTimeout(() => setShowFloat(false), 700);
    return () => clearTimeout(timer);
  }, [complete]);

  // An incomplete row travels right, a complete one travels left. The
  // opposite direction is clamped to zero rather than merely ignored,
  // so the card cannot be dragged toward an action that does not exist.
  const dragConstraints = complete ? { left: -140, right: 0 } : { left: 0, right: 140 };

  const completeReveal = useTransform(x, [0, COMMIT_DISTANCE], [0, 1]);
  const undoReveal = useTransform(x, [-COMMIT_DISTANCE, 0], [1, 0]);

  function handleDrag(_: unknown, info: { offset: { x: number } }) {
    const distance = Math.abs(info.offset.x);
    if (distance > DRAG_SLOP) dragged.current = true;

    const past = distance >= COMMIT_DISTANCE;
    if (past && !armed.current) {
      armed.current = true;
      navigator.vibrate?.(12);
    } else if (!past && armed.current) {
      armed.current = false;
    }
  }

  function handleDragEnd(_: unknown, info: { offset: { x: number }; velocity: { x: number } }) {
    const offset = info.offset.x;
    const velocity = info.velocity.x;
    armed.current = false;

    const towardCommit = complete ? offset < 0 : offset > 0;
    const farEnough = Math.abs(offset) >= COMMIT_DISTANCE;
    const fastEnough = Math.abs(velocity) >= COMMIT_VELOCITY;

    if (towardCommit && (farEnough || fastEnough)) onToggle();

    // Released without committing, or committed: either way the card
    // returns. `dragSnapToOrigin` handles the spring back; this only
    // clears the tap guard, one frame later so the click that follows
    // pointer-up still sees it.
    setTimeout(() => {
      dragged.current = false;
    }, 0);
  }

  return (
    <div
      data-testid={`quest-row-${template.key}`}
      className={[
        'cut-sm relative mb-0.5 overflow-hidden',
        disabled ? 'opacity-40' : '',
      ].join(' ')}
    >
      {/* What the swipe is about to do, revealed as the card slides off
          it. Decoration for assistive tech: the button inside carries
          the real label and the real action. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-between px-4">
        <motion.span
          className="flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.18em]"
          style={{ opacity: completeReveal, color: theme.color }}
        >
          <Check size={13} weight="bold" />
          ⟨ COMPLETE ⟩
        </motion.span>
        <motion.span
          className="flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-ink-700"
          style={{ opacity: undoReveal }}
        >
          ⟨ UNDO ⟩
          <ArrowUUpLeft size={13} weight="bold" />
        </motion.span>
      </div>

      <motion.div
        drag={disabled ? false : 'x'}
        dragDirectionLock
        dragConstraints={dragConstraints}
        dragElastic={0.16}
        dragSnapToOrigin
        onDrag={handleDrag}
        onDragEnd={handleDragEnd}
        transition={{ type: 'spring', stiffness: 520, damping: 34 }}
        className={[
          // 56px, not the 64px --row-min: six of these plus the header, the
          // System line and three footer blocks have to fit 412x915 without
          // scrolling (final/06 §5.2). The inner targets are untouched — the
          // circle is still 44x44 and the row body still clears min-h-tap.
          'cut-sm relative flex min-h-[52px] items-center gap-3 px-3 py-1',
          // Vertical panning still belongs to the page. Without this the
          // browser hands the whole gesture to the drag and the list
          // stops scrolling under a thumb that starts on a row.
          disabled ? '' : 'touch-pan-y',
        ].join(' ')}
        style={{
          x,
          border: complete
            ? '1px solid rgba(192, 132, 252, 0.4)'
            : '1px solid rgba(77, 163, 255, 0.22)',
          background: complete
            ? 'linear-gradient(180deg, rgba(35, 18, 55, 0.75), rgba(18, 10, 32, 0.85))'
            : 'linear-gradient(180deg, rgba(12, 22, 38, 0.75), rgba(7, 13, 24, 0.85))',
          boxShadow: complete ? '0 0 14px rgba(168, 85, 247, 0.15)' : 'none',
        }}
      >
        <button
          type="button"
          onClick={() => {
            // A release that travelled is a swipe, not a tap. Without
            // this the sheet opens every time you complete a quest.
            if (dragged.current) return;
            onOpen();
          }}
          disabled={disabled}
          data-testid={`quest-row-${template.key}-open`}
          className="relative flex min-h-tap min-w-0 flex-1 items-center gap-3 text-left"
        >
          {/* Futuristic Icon Tile Box */}
          <div
            aria-hidden
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] transition-transform duration-150"
            style={{
              background: theme.bg,
              border: `1px solid ${theme.border}`,
              boxShadow: theme.glow,
            }}
          >
            <Glyph size={18} weight="fill" color={theme.color} />
          </div>

          <span className="flex min-w-0 flex-col justify-center">
            <span className="truncate text-xs font-bold uppercase tracking-[0.14em] text-ink-100">
              {template.title}
            </span>
            <span className="truncate text-[11px] text-ink-900">{ROW_SUMMARY[key]}</span>
          </span>
        </button>

        <span className="relative shrink-0 font-mono text-xs font-semibold tabular-nums text-accent-mid">
          +{displayedXp} XP
          {capped && <span className="ml-1 text-[10px] text-faint">capped</span>}
          {showFloat && (
            <span aria-hidden className="animate-float-xp absolute -right-2 -top-4 font-mono text-xs font-bold text-accent-bright glow-text z-30">
              +{displayedXp} XP
            </span>
          )}
        </span>

        {/* The gesture's equal, not its fallback. See the note on the
            component: a swipe cannot be reached by keyboard or announced
            to a screen reader, so the button is what guarantees the core
            loop is operable by everyone. */}
        <motion.button
          type="button"
          onClick={onToggle}
          disabled={disabled}
          whileTap={disabled ? undefined : { scale: 0.85 }}
          transition={{ type: 'spring', stiffness: 500, damping: 25 }}
          aria-label={complete ? `Undo ${template.title}` : `Complete ${template.title}`}
          aria-pressed={complete}
          className="relative flex h-[44px] w-[44px] shrink-0 items-center justify-center"
        >
          <span
            className="flex h-6 w-6 items-center justify-center rounded-pill transition-all duration-200"
            style={{
              border: complete ? 'none' : '1.5px solid rgba(120, 140, 165, 0.5)',
              background: complete ? 'linear-gradient(135deg, #c084fc, #9333ea)' : 'transparent',
              boxShadow: complete ? '0 0 12px rgba(168, 85, 247, 0.6)' : 'none',
            }}
          >
            {complete ? <Check size={14} weight="bold" color="#ffffff" /> : null}
          </span>
        </motion.button>

        {/* The swipe affordance. A gesture nobody can see is a gesture
            nobody uses, so the chevron drifts in the direction the row
            travels — right while there is something to complete, left
            once there is only something to undo. */}
        <span
          aria-hidden
          className="relative shrink-0 text-ink-700"
          style={
            disabled
              ? undefined
              : {
                  animation: 'swipe-hint 3.6s ease-in-out infinite',
                  transform: complete ? 'scaleX(-1)' : undefined,
                }
          }
        >
          <CaretDoubleRight size={13} weight="bold" />
        </span>
      </motion.div>
    </div>
  );
}
