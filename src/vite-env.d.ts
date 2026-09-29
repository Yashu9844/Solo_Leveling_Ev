/// <reference types="vite/client" />

/** Injected by vite.config.ts from package.json. */
declare const __APP_VERSION__: string;

interface ImportMetaEnv {
  /** Optional IndexedDB name override for platform/preview builds (src/db/db.ts). */
  readonly VITE_DB_NAME?: string;
}
