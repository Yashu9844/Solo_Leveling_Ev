// Connection safety for schema upgrades (platform/04 §34.2, platform/05 loop 5.1).
//
// The service worker auto-updates, so a new build can reach a phone while an
// older tab still holds the database open. IndexedDB then cannot upgrade: the
// new connection waits ("blocked") until the old one closes. Two handlers keep
// that from ever becoming a frozen screen:
//   - the OLD connection, told a newer version wants in ("versionchange"),
//     closes itself and reloads into the new build;
//   - the NEW connection, if it is blocked anyway, tells the person plainly.
// Neither touches data: the upgrade itself is additive and transforms nothing.
//
// A DELETION also fires "versionchange" (newVersion is null) - the app's own
// "delete everything" does it, and so do tests that wipe the database. The
// connection must close or the delete would hang, but there is no newer build to
// reload into, so it does not reload.
import type Dexie from 'dexie';

export interface ConnectionHooks {
  /** Reload into the newer build. */
  reload(): void;
  /** An upgrade is waiting on another open tab. */
  blocked(): void;
}

export function installConnectionSafety(database: Dexie, hooks: ConnectionHooks): void {
  database.on('versionchange', (event) => {
    database.close();
    if (event.newVersion !== null) hooks.reload();
    // Returning false stops Dexie's default handler, which would close the
    // connection but leave the page running against a database it cannot read.
    return false;
  });
  database.on('blocked', () => {
    hooks.blocked();
  });
}

/** The browser wiring; a no-op outside one (tests, scripts). */
export function browserConnectionHooks(): ConnectionHooks {
  if (typeof window === 'undefined') return { reload() {}, blocked() {} };
  return {
    reload: () => window.location.reload(),
    blocked: () => window.dispatchEvent(new CustomEvent('system-db-blocked')),
  };
}

/** The plain-language notice shown when an upgrade is blocked by another tab. */
export const BLOCKED_NOTICE = 'THE SYSTEM IS UPDATING. Close any other open tab of this app, then reopen it.';
