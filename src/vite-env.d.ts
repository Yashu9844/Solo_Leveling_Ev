/// <reference types="vite/client" />

/** Injected by vite.config.ts from package.json. */
declare const __APP_VERSION__: string;

interface ImportMetaEnv {
  /** Optional IndexedDB name override for platform/preview builds (src/db/db.ts). */
  readonly VITE_DB_NAME?: string;
  /** On unless 'false' (src/flags.ts engineV2Enabled): the Blueprint engine. */
  readonly VITE_ENGINE_V2?: string;
  /** On unless 'false': the adaptive onboarding for new arcs (src/flags.ts newOnboardingEnabled; needs VITE_ENGINE_V2). */
  readonly VITE_NEW_ONBOARDING?: string;
}
