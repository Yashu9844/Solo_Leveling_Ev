// `npm run bench` - what a full rebuild costs on each engine, on logs of growing size
// (platform/04 §33.3: full rebuild @ 12k events < 150 ms compute). Every write the app
// makes triggers one of these, so it is the number that decides whether a tap feels instant.
import { buildProjectionsV2 } from '../src/blueprint/engine/projections';
import { recordsFromEvents } from '../src/blueprint/evaluate/env';
import { resolveBlueprints } from '../src/blueprint/resolve';
import { buildProjections } from '../src/db/projections';
import { DEFAULT_CONFIG } from '../src/engine/config';
import { applyEvents } from '../src/engine/reduce';
import { legacyActivityLog } from '../tests/engine/support/legacyActivityLog';

const deps = { now: () => '2026-10-01T00:00:00Z', newId: () => 'bench' };

function time<T>(runs: number, work: () => T): number {
  work(); // warm up
  const start = performance.now();
  for (let i = 0; i < runs; i++) work();
  return (performance.now() - start) / runs;
}

console.log('events   legacy    V2   (resolve  applyEvents  upcast)   ms per full rebuild');
for (const days of [40, 120, 365]) {
  const events = legacyActivityLog({ seed: 42, days });
  const runs = events.length > 3000 ? 5 : 15;
  const legacy = time(runs, () => buildProjections(events, DEFAULT_CONFIG, deps));
  const v2 = time(runs, () => buildProjectionsV2(events, deps));
  const resolve = time(runs, () => resolveBlueprints(events));
  const reduce = time(runs, () => applyEvents(events, DEFAULT_CONFIG));
  const upcast = time(runs, () => recordsFromEvents(events));
  console.log(`${String(events.length).padStart(6)}  ${legacy.toFixed(1).padStart(6)}  ${v2.toFixed(1).padStart(6)}   (${resolve.toFixed(1).padStart(6)}  ${reduce.toFixed(1).padStart(6)}  ${upcast.toFixed(1).padStart(6)})`);
}
