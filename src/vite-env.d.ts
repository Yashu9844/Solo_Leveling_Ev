/// <reference types="vite/client" />

/** Injected by vite.config.ts from package.json. */
declare const __APP_VERSION__: string;

interface ImportMetaEnv {
  /** Optional IndexedDB name override for platform/preview builds (src/db/db.ts). */
  readonly VITE_DB_NAME?: string;
  /** 'true' builds the adaptive onboarding for new arcs (src/flags.ts newOnboardingEnabled; needs VITE_ENGINE_V2). */
  readonly VITE_NEW_ONBOARDING?: string;
}
