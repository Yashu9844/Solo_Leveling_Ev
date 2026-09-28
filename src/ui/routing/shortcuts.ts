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
export const OPEN_PARAM = 'open';

export type OpenTarget = 'dsa' | 'career' | 'review';

export const OPEN_TARGETS: readonly OpenTarget[] = ['dsa', 'career', 'review'];

/** Shortcut path (as declared in the manifest) → what Today should open. */
export const SHORTCUT_ROUTES: { path: string; target: OpenTarget }[] = [
  { path: '/log/problem', target: 'dsa' },
  { path: '/log/application', target: 'career' },
  { path: '/review', target: 'review' },
];

export function parseOpenTarget(value: string | null): OpenTarget | null {
  return value !== null && (OPEN_TARGETS as readonly string[]).includes(value)
    ? (value as OpenTarget)
    : null;
}
