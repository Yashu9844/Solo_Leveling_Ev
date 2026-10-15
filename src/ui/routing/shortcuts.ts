/**
 * PWA app-shortcut targets.
 *
 * `vite.config.ts` has declared three long-press shortcuts since Slice 1
 * — Log problem, Log application, Evening review — but nothing ever
 * handled their URLs. They fell through to the catch-all route, so the
 * user long-pressed "Log problem", waited for a cold start, and landed
 * on a plain Today with no sheet open. The shortcut worked in the sense
 * that it opened the app, and failed at the only thing it promised.
 *
 * Each now resolves to `/today?open=<key>`, and Today opens the matching
 * surface (wired in task 6.3). One search param rather than three routes
 * keeps the deep link shareable and survives a reload.
 */
import { LEGACY_SHORTCUT_TARGETS } from '../instruments/legacy/shortcuts';

export const OPEN_PARAM = 'open';

// A target is 'review', or the id of the domain whose log the shortcut asks for.
export type OpenTarget = string;

export const OPEN_TARGETS: readonly OpenTarget[] = [...LEGACY_SHORTCUT_TARGETS.map(({ target }) => target), 'review'];

/** Shortcut path (as declared in the manifest) → what Today should open. */
export const SHORTCUT_ROUTES: { path: string; target: OpenTarget }[] = [
  ...LEGACY_SHORTCUT_TARGETS,
  { path: '/review', target: 'review' },
];

export function parseOpenTarget(value: string | null): OpenTarget | null {
  return value !== null && (OPEN_TARGETS as readonly string[]).includes(value)
    ? (value as OpenTarget)
    : null;
}

/**
 * The Blueprint-neutral shortcut paths (platform/03 §27.3). The manifest keeps the older paths
 * above forever - an installed WebAPK caches its manifest - and these resolve, per System, to the
 * domain that declares the slot.
 */
export const ALIAS_ROUTES: { path: string; slot: 'primary' | 'evidence' }[] = [
  { path: '/log/primary', slot: 'primary' },
  { path: '/log/evidence', slot: 'evidence' },
];

export function aliasTarget(domains: readonly { id: string; shortcut?: 'primary' | 'evidence' }[], slot: 'primary' | 'evidence'): OpenTarget | null {
  return domains.find((domain) => domain.shortcut === slot)?.id ?? null;
}
