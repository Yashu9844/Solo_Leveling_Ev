/**
 * The four rune glyphs.
 *
 * Deliberately not an icon-library import. A house, a line chart, a tree
 * and a user-circle are the four most generic glyphs in software, and the
 * bottom rail is the one surface on screen at every moment of the app's
 * life — it cannot be the one surface that looks bought.
 *
 * All four are drawn on the same 24×24 grid out of the same three
 * primitives the design system already uses elsewhere: mitred angles, a
 * chamfered diamond "core", and hairlines that carry the accent. They are
 * stroke-only when dormant; the core fills and lights when the tab is the
 * one you are standing on (design/00-DESIGN-SYSTEM.md §2.1 — nothing
 * glows that isn't important).
 */

import type { ReactNode } from 'react';

interface RuneProps {
  /** Lights the core and thickens the frame. */
  active: boolean;
}

const FRAME = {
  fill: 'none',
  stroke: 'currentColor',
  strokeLinejoin: 'miter' as const,
  strokeLinecap: 'square' as const,
};

function Svg({ children, active }: RuneProps & { children: ReactNode }) {
  return (
    <svg
      width={24}
      height={24}
      viewBox="0 0 24 24"
      aria-hidden
      style={{
        // The dormant frame is a hairline; the lit one has weight. Both
        // are the same path, so the change reads as illumination rather
        // than as a different icon swapping in.
        strokeWidth: active ? 1.75 : 1.3,
        transition: 'stroke-width var(--duration-fast) var(--ease-system)',
        overflow: 'visible',
      }}
    >
      {children}
    </svg>
  );
}

/** The chamfered core every rune carries — dark when dormant, lit when not. */
function Core({ active, cx, cy, r = 2.1 }: RuneProps & { cx: number; cy: number; r?: number }) {
  return (
    <>
      <path
        d={`M${cx} ${cy - r}L${cx + r} ${cy}L${cx} ${cy + r}L${cx - r} ${cy}Z`}
        fill={active ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeLinejoin="miter"
        style={{ transition: 'fill var(--duration-fast) var(--ease-system)' }}
      />
      {active && (
        <path
          d={`M${cx} ${cy - r}L${cx + r} ${cy}L${cx} ${cy + r}L${cx - r} ${cy}Z`}
          fill="currentColor"
          style={{
            transformOrigin: `${cx}px ${cy}px`,
            transform: 'scale(2.1)',
            opacity: 0.18,
            animation: 'pulse-glow 2600ms var(--ease-system-in-out) infinite',
          }}
        />
      )}
    </>
  );
}

/**
 * TODAY — the gate. You step through one of these each morning.
 *
 * Flat lintel with chamfered shoulders, open at the floor, standing on two
 * feet. The peaked roof and closed baseline that the first pass had made it
 * read as a house — which is the generic glyph this set exists to avoid.
 */
export function GateRune({ active }: RuneProps) {
  return (
    <Svg active={active}>
      <path {...FRAME} d="M5 21V8.6l3.2-3.2h7.6L19 8.6V21" />
      <path {...FRAME} d="M3 21h3.7" />
      <path {...FRAME} d="M17.3 21H21" />
      <Core active={active} cx={12} cy={13.4} r={2.5} />
    </Svg>
  );
}

/** PROGRESS — the ascent. Three rungs and the height still to climb. */
export function AscentRune({ active }: RuneProps) {
  return (
    <Svg active={active}>
      <path {...FRAME} d="M4.4 21.2L12 15.9l7.6 5.3" />
      <path {...FRAME} d="M6.6 15.4L12 11.6l5.4 3.8" opacity={active ? 1 : 0.85} />
      <path {...FRAME} d="M8.8 9.9L12 7.6l3.2 2.3" opacity={active ? 1 : 0.7} />
      <Core active={active} cx={12} cy={4} r={2} />
    </Svg>
  );
}

/** SKILLS — the tree, literally: a root that forks into what it unlocks. */
export function TreeRune({ active }: RuneProps) {
  return (
    <Svg active={active}>
      <path {...FRAME} d="M12 6.6v5.9" />
      <path {...FRAME} d="M5.6 16.2v-3.7h12.8v3.7" />
      <Core active={active} cx={12} cy={4.2} r={2.2} />
      <path
        {...FRAME}
        d="M5.6 16.2l1.9 1.9-1.9 1.9-1.9-1.9z"
        fill={active ? 'currentColor' : 'none'}
        opacity={active ? 0.75 : 1}
      />
      <path
        {...FRAME}
        d="M18.4 16.2l1.9 1.9-1.9 1.9-1.9-1.9z"
        fill={active ? 'currentColor' : 'none'}
        opacity={active ? 0.75 : 1}
      />
    </Svg>
  );
}

/** PROFILE — the crest, with the one lit eye the art direction is built on. */
export function CrestRune({ active }: RuneProps) {
  return (
    <Svg active={active}>
      <path {...FRAME} d="M12 2.4l8.2 4.6v8.4L12 20l-8.2-4.6V7z" />
      <path {...FRAME} d="M7.4 11.2h3.1" opacity={0.9} />
      <path {...FRAME} d="M13.5 11.2h3.1" opacity={0.9} />
      <Core active={active} cx={12} cy={11.2} r={1.9} />
    </Svg>
  );
}
