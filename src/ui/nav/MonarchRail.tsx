import { NavLink } from 'react-router-dom';
import { motion } from 'framer-motion';
import type { ComponentType } from 'react';
import { AscentRune, CrestRune, GateRune, TreeRune } from './runes';

/**
 * The four peers.
 *
 * Labels, order and route paths are frozen by the test contract
 * (design/00-DESIGN-SYSTEM.md §10): the nav is `role="navigation"` named
 * "Primary", containing four links named TODAY PROGRESS SKILLS PROFILE,
 * each matched by a heading of the same name. Everything below that line
 * is rendering, and rendering is free.
 */
const TABS: { to: string; label: string; rune: ComponentType<{ active: boolean }> }[] = [
  { to: '/today', label: 'TODAY', rune: GateRune },
  { to: '/progress', label: 'PROGRESS', rune: AscentRune },
  { to: '/skills', label: 'SKILLS', rune: TreeRune },
  { to: '/profile', label: 'PROFILE', rune: CrestRune },
];

/** The lit tab's plinth: a keystone, wider at its base than at its lip. */
const PLINTH_CLIP = 'polygon(16px 0, calc(100% - 16px) 0, 100% 100%, 0 100%)';

/** Weighted so the plinth arrives just after the screen does, not with it. */
const PLINTH_SPRING = { type: 'spring', stiffness: 420, damping: 38, mass: 0.8 } as const;

interface MonarchRailProps {
  /** The current route, so the tab a child route lives under stays lit. */
  pathname: string;
  /** Tapping the tab you are already on — the shell scrolls you to top. */
  onTabClick: (to: string) => void;
}

/**
 * The bottom rail — the gate rail.
 *
 * A four-icon bar is the most generic object in mobile software, and this
 * is the one surface on screen at every moment of the app's life, so it is
 * built as a piece of the system's own machinery rather than as a strip of
 * buttons:
 *
 *  - The lit tab stands on a **keystone plinth** with a lit lip, and the
 *    plinth *travels* between tabs (one shared `layoutId`) instead of
 *    cutting. The eye follows one object across the rail, which is what
 *    makes four screens feel like four rooms of one place.
 *  - A **beam** falls from the rail's top edge into the lit rune, and an
 *    ambient halo slides with it. That is the whole trick of the reference
 *    art: the light has a source and a direction.
 *  - The rail's top edge is a hairline that fades at both ends, with
 *    bracket ticks at the corners — the same frame language as the panels.
 *
 * Every colour-bearing value reads a theme token, so the rail follows the
 * user's accent and goes correctly flat under abyss, contrast and daylight,
 * where `--glow-*` resolves to `none` (design/03 §3). The framer-motion
 * pieces are governed by `MotionRoot`'s `MotionConfig`, so reduced motion
 * stills the plinth without a second switch here.
 */
export function MonarchRail({ pathname, onTabClick }: MonarchRailProps) {
  return (
    <nav
      aria-label="Primary"
      // `z-0` against main's `z-10` is load-bearing: full-screen overlays
      // render inside main's subtree and must paint above the rail.
      className="relative z-0 shrink-0"
      style={{
        background: 'linear-gradient(180deg, var(--abyss), var(--void))',
        paddingBottom: 'max(env(safe-area-inset-bottom), 8px)',
        boxShadow: '0 -18px 40px -22px var(--void)',
      }}
    >
      {/* Top edge: a rule that fades to nothing at both ends, never a
          border — a border draws into the corners and makes the rail read
          as a box bolted on rather than as the floor of the screen. */}
      <div className="hairline absolute inset-x-0 top-0" />

      {/* Corner brackets: two ticks, the frame language the panels use.
          They anchor the rail's width at a glance. */}
      <span
        aria-hidden
        className="pointer-events-none absolute left-0 top-0 h-[7px] w-[10px]"
        style={{
          borderLeft: '1px solid var(--hair-strong)',
          borderTop: '1px solid var(--hair-strong)',
        }}
      />
      <span
        aria-hidden
        className="pointer-events-none absolute right-0 top-0 h-[7px] w-[10px]"
        style={{
          borderRight: '1px solid var(--hair-strong)',
          borderTop: '1px solid var(--hair-strong)',
        }}
      />

      <div className="relative flex items-stretch">
        {TABS.map((tab) => {
          // Prefix match, not equality: /profile/settings is a child route
          // of the profile tab (design/02 §3.2) and must keep it lit.
          const active = pathname === tab.to || pathname.startsWith(`${tab.to}/`);
          const Rune = tab.rune;

          return (
            <NavLink
              key={tab.to}
              to={tab.to}
              onClick={() => onTabClick(tab.to)}
              className="relative flex min-h-tap flex-1 flex-col items-center justify-end gap-[6px] pb-[7px] pt-[11px]"
              style={{ color: active ? 'var(--accent-core)' : 'var(--ink-900)' }}
            >
              {active && (
                <>
                  {/* The ambient halo — the rail's light source, bled up
                      through the top edge. Travels with the plinth. */}
                  <motion.span
                    layoutId="rail-halo"
                    aria-hidden
                    className="pointer-events-none absolute -top-[16px] left-1/2 h-[32px] w-[112%] -translate-x-1/2"
                    style={{
                      background:
                        'radial-gradient(58% 100% at 50% 100%, var(--hair) 0%, transparent 74%)',
                    }}
                    transition={PLINTH_SPRING}
                  />

                  <motion.span
                    layoutId="rail-plinth"
                    aria-hidden
                    className="pointer-events-none absolute inset-0"
                    transition={PLINTH_SPRING}
                  >
                    {/* The keystone itself. */}
                    <span
                      className="absolute inset-0"
                      style={{
                        clipPath: PLINTH_CLIP,
                        background:
                          'linear-gradient(180deg, var(--hair) 0%, var(--fill-faint) 52%, transparent 100%)',
                      }}
                    />
                    {/* Its lit lip, inset to the chamfer so it stops where
                        the bevel starts instead of running off the edge. */}
                    <span
                      className="absolute left-[16px] right-[16px] top-0 h-[1.5px]"
                      style={{
                        background:
                          'linear-gradient(90deg, transparent, var(--accent-core), transparent)',
                        boxShadow: 'var(--glow-sm)',
                      }}
                    />
                    {/* The beam, falling from the lip into the rune. */}
                    <span
                      className="absolute left-1/2 top-0 h-[22px] w-[1.5px] -translate-x-1/2"
                      style={{
                        background: 'linear-gradient(180deg, var(--accent-bright), transparent)',
                        opacity: 0.65,
                      }}
                    />
                  </motion.span>

                  {/* One-shot spark on arrival: a chamfered ring that opens
                      out of the rune and is gone in half a second. Keyed on
                      the route so it fires per activation, not per render. */}
                  <motion.span
                    key={`spark-${tab.to}`}
                    aria-hidden
                    className="pointer-events-none absolute left-1/2 top-[13px] h-[26px] w-[26px] -translate-x-1/2"
                    initial={{ scale: 0.4, opacity: 0.8 }}
                    animate={{ scale: 1.9, opacity: 0 }}
                    transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                    style={{
                      border: '1px solid var(--accent-bright)',
                      clipPath: 'polygon(50% 0, 100% 50%, 50% 100%, 0 50%)',
                    }}
                  />
                </>
              )}

              <motion.span
                whileTap={{ scale: 0.86 }}
                transition={{ type: 'spring', stiffness: 520, damping: 26 }}
                className="relative z-10 flex flex-col items-center gap-[6px]"
              >
                <span
                  className="flex h-6 items-center justify-center"
                  style={{
                    filter: active ? 'var(--glow-icon, none)' : 'none',
                    color: active ? 'var(--accent-bright)' : 'var(--ink-900)',
                    transition: 'color var(--duration-fast) var(--ease-system)',
                  }}
                >
                  <Rune active={active} />
                </span>

                {/* The label never leaves the DOM — it *is* the link's
                    accessible name, which the e2e suite navigates by. */}
                <span
                  className="text-micro uppercase leading-none"
                  style={{
                    letterSpacing: active ? '0.17em' : '0.11em',
                    fontWeight: active ? 700 : 500,
                    color: active ? 'var(--accent-core)' : 'var(--faint)',
                    textShadow: active ? 'var(--glow-text)' : 'none',
                    transition:
                      'letter-spacing var(--duration-std) var(--ease-system), color var(--duration-fast) var(--ease-system)',
                  }}
                >
                  {tab.label}
                </span>
              </motion.span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
