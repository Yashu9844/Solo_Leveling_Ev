import { useEffect, useState } from 'react';
import { DEFAULT_CONFIG } from '../../engine/config';
import { arcDay, localDate } from '../../engine/time';
import { realDeps } from '../../store/deps';
import { db } from '../../db/db';
import { getBossStatus, clearBoss } from '../../store/boss';
import type { BossId, BossResult } from '../../engine/boss';
import { BOSSES } from '../../engine/boss';
import { BossClearedMoment } from '../moments/BossClearedMoment';
import { ArtLayer, Panel, PrimaryButton, SectionLabel } from '../kit';

/** final/01 §7 — "Announced 7 days ahead with a live checklist. Cannot
 * be failed; a missed window reopens at the next checkpoint." The
 * 7-days-ahead announcement timing isn't modelled (it would need a
 * scheduled-notification system this build doesn't have) — every boss
 * is just listed here from the day its window opens. */
export function BossList() {
  const [statuses, setStatuses] = useState<BossResult[] | null>(null);
  const [day, setDay] = useState<number | null>(null);
  const [clearingId, setClearingId] = useState<BossId | null>(null);
  const [clearedMoment, setClearedMoment] = useState<{ id: BossId; title: string } | null>(null);
  const today = localDate(realDeps.now(), DEFAULT_CONFIG.arc.timezone, DEFAULT_CONFIG.arc.dayBoundaryHour);

  async function refresh() {
    const [results, arc] = await Promise.all([
      Promise.all(BOSSES.map((b) => getBossStatus(b.id, today))),
      db.arc.toCollection().first(),
    ]);
    setStatuses(results);
    if (arc) setDay(arcDay(realDeps.now(), arc.start_date, arc.timezone, arc.day_boundary_hour));
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [today]);

  async function handleClear(bossId: BossId) {
    const arc = await db.arc.toCollection().first();
    if (!arc || clearingId) return;
    setClearingId(bossId);
    try {
      const result = await clearBoss(bossId, arc.id, today, DEFAULT_CONFIG, realDeps);
      if (result.cleared) setClearedMoment({ id: bossId, title: result.boss.title });
      await refresh();
    } finally {
      setClearingId(null);
    }
  }

  const visible = (statuses ?? []).filter((s) => s.windowOpen || s.cleared);

  // Nothing open yet is the state for most of the first month, and the
  // old component rendered nothing at all for it. That is a waste of the
  // one thing bosses are for: knowing what is coming. So the section
  // still appears, showing the next locked boss on the throne plate —
  // named, dated, and visibly out of reach.
  const nextLocked = day !== null ? BOSSES.find((b) => day < b.windowStartDay) : undefined;
  if (visible.length === 0 && !nextLocked) return null;

  return (
    <div className="mt-6" data-testid="boss-list">
      <SectionLabel rule className="mb-2">
        Bosses
      </SectionLabel>

      {/* The only place --boss red appears in the whole app
          (design/00 §2.5). It means one thing here, so it can keep
          meaning it. */}
      <div className="relative mb-3 h-[104px] overflow-hidden">
        <ArtLayer slot={visible.length > 0 ? 'boss' : 'boss-throne'} scrim="band" focal="50% 40%" />
      </div>

      {visible.map((status) => {
        const metCount = status.conditions.filter((c) => c.met).length;
        const total = status.conditions.length;
        const ready = metCount >= total;

        return (
          <Panel
            key={status.boss.id}
            cut="md"
            className="mb-3"
            bodyClassName="px-4 py-4"
            // Panel draws its border as an outer layer whose background
            // IS the border colour, so this is how a card gets a boss-red
            // edge. A cleared boss drops back to the hairline: it is
            // history at that point, not a live threat.
            style={{ background: status.cleared ? 'var(--hair)' : 'var(--boss)' }}
          >
            <div className="flex items-baseline justify-between gap-3">
              <p className="min-w-0 text-sm text-ink-100">
                {status.cleared ? '✓ ' : ''}BOSS {status.boss.id} · {status.boss.title}
              </p>
            </div>
            <p className="mt-1.5 font-mono text-xxs tabular-nums text-ink-700">
              Days {status.boss.windowStartDay}-{status.boss.windowEndDay} · {metCount} of {total} met
            </p>

            {!status.cleared && (
              <>
                {/* Conditions as shapes, not colour alone — final/06 §7.
                    A filled square is met, a hollow one is not, and the
                    row reads the same to anyone who cannot separate the
                    two tones. */}
                <ul className="mt-3 flex flex-col gap-1.5">
                  {status.conditions.map((c) => (
                    <li key={c.label} className="flex items-start gap-2.5 text-xs leading-[1.45]">
                      <span
                        aria-hidden
                        className="mt-[3px] h-2.5 w-2.5 shrink-0"
                        style={{
                          background: c.met ? 'var(--boss)' : 'transparent',
                          border: `1px solid ${c.met ? 'var(--boss)' : 'var(--hair)'}`,
                        }}
                      />
                      <span className={c.met ? 'text-ink-300' : 'text-ink-700'}>{c.label}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-4">
                  <PrimaryButton
                    tone="boss"
                    size="md"
                    disabled={!ready || clearingId === status.boss.id}
                    onClick={() => void handleClear(status.boss.id)}
                  >
                    {clearingId === status.boss.id
                      ? 'Clearing…'
                      : `Clear boss · +${DEFAULT_CONFIG.bossXp} XP`}
                  </PrimaryButton>
                </div>
              </>
            )}
          </Panel>
        );
      })}

      {visible.length === 0 && nextLocked && day !== null && (
        <Panel cut="md" bodyClassName="px-4 py-4">
          <p className="text-sm text-ink-500">
            BOSS {nextLocked.id} · {nextLocked.title}
          </p>
          <p className="mt-1.5 font-mono text-xxs tabular-nums text-faint">
            Opens Day {nextLocked.windowStartDay} · {nextLocked.windowStartDay - day} days away
          </p>
        </Panel>
      )}

      {clearedMoment && (
        <BossClearedMoment bossId={clearedMoment.id} bossTitle={clearedMoment.title} onDismiss={() => setClearedMoment(null)} />
      )}
    </div>
  );
}
