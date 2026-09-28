import { describe, it, expect } from 'vitest';
import { isLaundryDue, maintenanceAllDone } from '../../src/engine/maintenance';

describe('isLaundryDue', () => {
  it('is due on the arc start date and every Nth day after', () => {
    expect(isLaundryDue('2026-09-01', '2026-09-01', 3)).toBe(true);
    expect(isLaundryDue('2026-09-02', '2026-09-01', 3)).toBe(false);
    expect(isLaundryDue('2026-09-03', '2026-09-01', 3)).toBe(false);
    expect(isLaundryDue('2026-09-04', '2026-09-01', 3)).toBe(true);
    expect(isLaundryDue('2026-09-07', '2026-09-01', 3)).toBe(true);
  });

  it('is never due before the arc starts', () => {
    expect(isLaundryDue('2026-08-31', '2026-09-01', 3)).toBe(false);
  });
});

describe('maintenanceAllDone', () => {
  it('requires bath and fuel always, laundry only when due', () => {
    expect(maintenanceAllDone(true, true, false, false)).toBe(true); // not due, ignored
    expect(maintenanceAllDone(true, true, true, false)).toBe(false); // due, not done
    expect(maintenanceAllDone(true, true, true, true)).toBe(true); // due, done
    expect(maintenanceAllDone(false, true, false, false)).toBe(false);
    expect(maintenanceAllDone(true, false, false, false)).toBe(false);
  });
});
