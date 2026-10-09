// `npm run shadow` — run the Blueprint engine beside the legacy engine and
// report every difference (platform/05 loop 4.8, equivalence levels E1/E2).
//
//   npm run shadow                  full run: golden + 100 activity seeds + 1000 fuzz logs (E1),
//                                   golden days + 10 fuzz logs (E2), and the owner export if present
//   npm run shadow -- --quick       a few-second smoke run
//   npm run shadow -- --fuzz 5000 --activity 300 --e2-fuzz 25
//   npm run shadow -- --no-owner    ignore platform-fixtures/private/owner-export.json
//
// The owner export is personal data and never leaves the machine: nothing in
// the report quotes it beyond day counts and the first differing field.
// Exit status 1 means at least one difference.
import { formatReport, runShadow } from '../tests/engine/support/shadow';
import { loadOwnerExport } from '../tests/engine/support/ownerFixture';
import type { CheckpointRow } from '../src/db/schema';

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(`--${name}`);
const value = (name: string, fallback: number) => {
  const at = args.indexOf(`--${name}`);
  return at >= 0 ? Number(args[at + 1]) : fallback;
};

const quick = flag('quick');
const owner = flag('no-owner') ? null : loadOwnerExport();

const report = await runShadow({
  fuzzSeeds: quick ? 30 : value('fuzz', 1000),
  activitySeeds: quick ? 3 : value('activity', 100),
  fuzzE2Seeds: quick ? 1 : value('e2-fuzz', 10),
  goldenDays: quick ? [29, 119] : undefined,
  owner: owner ? { events: owner.snapshot.events, checkpoints: owner.snapshot.checkpoints as CheckpointRow[] } : undefined,
  log: (line) => console.log(`… ${line}`),
});

console.log(`\n${formatReport(report)}`);
if (!owner) console.log('(owner export not present: platform-fixtures/private/owner-export.json — owner comparison skipped)');
process.exit(report.ok ? 0 : 1);
