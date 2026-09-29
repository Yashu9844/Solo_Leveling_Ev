import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

export default tseslint.config(
  {
    // scripts/ is one-off Node tooling (icon generation), not app or test
    // code — it runs under Node globals this config doesn't declare.
    ignores: [
      'dist/**',
      'dev-dist/**',
      'coverage/**',
      'playwright-report/**',
      'test-results/**',
      'scripts/**',
      // Root-level _*-shot.mjs files are throwaway Playwright screenshot
      // scripts — same category as scripts/, same Node globals.
      '_*.mjs',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
    },
  },
  // ── The engine boundary ────────────────────────────────────────────────
  // src/engine/ must be pure and deterministic: no React, no Dexie, no
  // Zustand, no DOM globals, no ambient clock/randomness/uuid. The clock
  // and id generator are always injected via EngineDeps. Applies to every
  // engine file, implemented or not — this restriction never shrinks.
  {
    files: ['src/engine/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            'react*',
            'react-dom*',
            'dexie*',
            'zustand*',
            'uuid',
            '**/db/*',
            '**/store/*',
            '**/ui/*',
          ],
        },
      ],
      'no-restricted-globals': [
        'error',
        'window',
        'document',
        'localStorage',
        'indexedDB',
        'navigator',
      ],
      'no-restricted-properties': [
        'error',
        { object: 'Date', property: 'now', message: 'Inject the clock — see EngineDeps.now().' },
        { object: 'Math', property: 'random', message: 'Inject randomness — engine/ must stay deterministic.' },
        { object: 'crypto', property: 'randomUUID', message: 'Inject the id generator — see EngineDeps.newId().' },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "NewExpression[callee.name='Date']",
          message: 'Inject the clock — no `new Date()` in engine/.',
        },
      ],
    },
  },
  // ── The runtime-config seam (platform/05 loop 1.4) ─────────────────────
  // The engine config is the ARC's (store/engineConfig.ts), never the
  // owner's hard-coded DEFAULT_CONFIG — which carries Asia/Kolkata, the
  // 04:00 boundary and 2026-09-01 for every user. UI and store code read
  // getEngineConfig()/useEngineConfig() instead. Exempt: the runtime
  // config store itself (it is where the defaults live) and onboarding's
  // initial form, which runs before any arc exists (removed in loop 1.5).
  {
    files: ['src/ui/**/*.{ts,tsx}', 'src/store/**/*.{ts,tsx}'],
    ignores: ['src/store/engineConfig.ts', 'src/ui/onboarding/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/engine/config', '**/engine'],
              importNames: ['DEFAULT_CONFIG'],
              message: "Use the arc's config: getEngineConfig() / useEngineConfig() from store/engineConfig.",
            },
          ],
        },
      ],
    },
  },
  // ── Stub-args allowance — shrinks every slice ──────────────────────────
  // Phase 0 stub functions have full typed signatures but throw
  // 'Not implemented — Slice N' instead of a body (final/09 Step 3), so
  // their parameters are intentionally unused. As each file gets a real
  // implementation it comes OFF this file list. Slice 1: quests.ts's
  // generateCoreQuestTemplates. Slice 2: quests.ts's generateQuests and
  // reduce.ts. Slice 3: xp.ts and level.ts. Slice 4: streak.ts. Slice 5:
  // messages.ts (P4/P5 only — see its header comment) — all fully
  // implemented; any still-unused parameter in an implemented file is
  // `void`-guarded per call site instead of blanket-allowed. Repeat this
  // shrinking every slice as rank.ts, attributes.ts, etc. land.
  {
    files: ['src/engine/**/*.ts'],
    ignores: [
      'src/engine/quests.ts',
      'src/engine/reduce.ts',
      'src/engine/xp.ts',
      'src/engine/level.ts',
      'src/engine/streak.ts',
      'src/engine/messages.ts',
      'src/engine/career.ts',
      'src/engine/srs.ts',
      'src/engine/dsa.ts',
    ],
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { args: 'none' }],
    },
  }
);
