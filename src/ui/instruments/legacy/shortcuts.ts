// The two shortcut paths the owner's installed app declares in its manifest (Log problem, Log
// application). An installed WebAPK caches its manifest, so these resolve forever; the
// Blueprint-neutral aliases (/log/primary, /log/evidence) are in ui/routing/shortcuts.ts.
export const LEGACY_SHORTCUT_TARGETS = [
  { path: '/log/problem', target: 'dsa' },
  { path: '/log/application', target: 'career' },
] as const;
