import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../../src/db/db';
import { appendEvent, getAllEvents } from '../../src/db/events';
import type { SystemEvent } from '../../src/engine/types';

function makeEvent(id: string, idemKey: string): SystemEvent {
  return {
    id,
    type: 'APP_OPENED',
    occurred_at: '2026-09-01T03:00:00Z',
    local_date: '2026-09-01',
    arc_id: 'arc-1',
    payload: {},
    source: 'system',
    idem_key: idemKey,
    schema_v: 1,
  };
}

describe('appendEvent — idempotency', () => {
  beforeEach(async () => {
    await db.event.clear();
  });

  it('appending twice with the same idem_key is a no-op and does not throw', async () => {
    const event = makeEvent('01H0000000000000000000001', 'idem-a');
    await appendEvent(event);
    await expect(appendEvent(event)).resolves.not.toThrow();

    const all = await getAllEvents();
    expect(all).toHaveLength(1);
  });

  it('two distinct idem_keys both persist', async () => {
    await appendEvent(makeEvent('01H0000000000000000000002', 'idem-b'));
    await appendEvent(makeEvent('01H0000000000000000000003', 'idem-c'));

    const all = await getAllEvents();
    expect(all).toHaveLength(2);
  });
});
