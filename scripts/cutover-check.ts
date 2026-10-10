// `npm run cutover:check` - may the owner's engine swap land TODAY?
// (platform/02 §22.3 step 4: not within ±3 days of a checkpoint.)
//
//   npm run cutover:check                       reads the arc start from platform-fixtures/private/owner-export.json
//   npm run cutover:check -- --start 2026-09-01 --on 2026-10-12
//
// Prints the verdict and, when it is no, the earliest safe date. Exit status 1 means "not today".
import { cutoverWindow } from '../src/blueprint/cutover';
import { loadOwnerExport } from '../tests/engine/support/ownerFixture';

const args = process.argv.slice(2);
const value = (name: string) => { const at = args.indexOf(`--${name}`); return at >= 0 ? args[at + 1] : undefined; };

let start = value('start');
if (!start) {
  const owner = loadOwnerExport();
  const arc = owner?.snapshot.arc as { start_date?: string } | null | undefined;
  start = arc?.start_date;
}
if (!start) {
  console.error('No arc start date: pass --start YYYY-MM-DD, or put the owner export at platform-fixtures/private/owner-export.json.');
  process.exit(2);
}
const on = value('on') ?? new Date().toISOString().slice(0, 10);
const verdict = cutoverWindow(start, on, [14, 30, 60, 90, 120]);
console.log(`${on}  ·  ${verdict.allowed ? 'OK to cut over' : 'NOT today'}\n${verdict.reason}`);
process.exit(verdict.allowed ? 0 : 1);
