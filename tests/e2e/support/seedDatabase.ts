// Seeds the app's IndexedDB with a log and everything derived from it, the way a rebuild would
// (shared by the E3 visual baseline and the synthetic-System smoke). The clock is the caller's.
import type { Page } from '@playwright/test';
import { buildProjectionsV2 } from '../../../src/blueprint/engine/projections';
import { buildDomainTables } from '../../../src/db/domainProjections';
import { DEFAULT_CONFIG } from '../../../src/engine/config';
import type { SystemEvent } from '../../../src/engine/types';
import { LEGACY_ARC_ID } from '../../engine/support/legacyActivityLog';

export async function seedDatabase(page: Page, events: SystemEvent[], now: string): Promise<void> {
  const tables = buildDomainTables(events, DEFAULT_CONFIG);
  // The five cache tables are what the app reads on boot; derive them exactly as a rebuild would.
  const cache = buildProjectionsV2(events, { now: () => now, newId: () => 'seeded' }); // byte-identical to the legacy builder for the owner (E1)
  const rows: Record<string, unknown[]> = {
    event: events,
    arc: [{
      id: LEGACY_ARC_ID, start_date: DEFAULT_CONFIG.arc.startDate, end_date: DEFAULT_CONFIG.arc.endDate, timezone: DEFAULT_CONFIG.arc.timezone,
      day_boundary_hour: DEFAULT_CONFIG.arc.dayBoundaryHour, day_close_hour: DEFAULT_CONFIG.arc.dayCloseHour, main_quest_text: 'Ship a working agent and land an offer.', status: 'active',
    }],
    profile: [{ id: 'profile', name: 'Ada', created_at: '2026-09-01T00:00:00Z', arc_timezone: DEFAULT_CONFIG.arc.timezone, settings: {} }],
    quest_template: cache.templates, quest_instance: cache.instances, xp_ledger: cache.ledger, day_rollup: cache.dayRollups, player_state: cache.playerState ? [cache.playerState] : [],
    application: tables.applications, career_event: tables.careerEvents, resume_version: tables.resumeVersions, dsa_problem: tables.dsaProblems,
    dsa_attempt: tables.dsaAttempts, learning_block: tables.learningBlocks, system_design_study: tables.systemDesigns, build_session: tables.buildSessions,
    artifact: tables.artifacts, training_session: tables.trainingSessions, metric_sample: tables.metricSamples, maintenance_log: tables.maintenanceLogs,
  };

  // The app creates the schema on first load; seed the stores it made, then boot again so it reads them.
  await page.goto('/start');
  await page.evaluate((payload) => new Promise<void>((resolve, reject) => {
    const open = indexedDB.open('system-arc');
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const database = open.result;
      const names = Object.keys(payload);
      const tx = database.transaction(names, 'readwrite');
      for (const name of names) for (const row of payload[name]!) tx.objectStore(name).put(row);
      tx.oncomplete = () => { database.close(); resolve(); };
      tx.onerror = () => reject(tx.error);
    };
  }), rows);
}
