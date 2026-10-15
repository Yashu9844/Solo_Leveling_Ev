import { useEffect, useState, type ReactNode } from 'react';
import { FEATURE_LABELS, type FeatureId, unlockLevel } from '../../blueprint/unlocks';
import { levelFor } from '../../engine/level';
import { getEngineConfig } from '../../store/engineConfig';
import { getTotalXp } from '../../store/playerState';
import { useSystem } from '../../store/SystemContext';

/** The level the person is at, once known (null until then). Only asked when the System gates something. */
function useLevel(enabled: boolean): number | null {
  const [level, setLevel] = useState<number | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    void getTotalXp().then((xp) => {
      if (!cancelled) setLevel(levelFor(xp, getEngineConfig()).level);
    });
    return () => {
      cancelled = true;
    };
  }, [enabled]);
  return level;
}

/**
 * Progressive disclosure (final/01 §3, platform/03 §27.3): a part of the app appears at the level the System names for it.
 * A System that names none - the owner's - is open everywhere, and this adds no element to the screen at all.
 */
export function FeatureGate({ feature, children }: { feature: FeatureId; children: ReactNode }) {
  const { blueprint } = useSystem();
  const at = unlockLevel(blueprint.progression, feature);
  const level = useLevel(at !== undefined);
  if (at === undefined) return <>{children}</>;
  if (level === null) return null;
  if (level >= at) return <>{children}</>;
  return (
    <p
      className="cut-sm mt-3 p-3 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-700"
      data-testid={`locked-${feature}`}
      style={{ borderLeft: '2px solid var(--hair)', background: 'var(--surface)' }}
    >
      ⟨ {FEATURE_LABELS[feature]} ⟩ OPENS AT LEVEL {at}. YOU ARE AT LEVEL {level}.
    </p>
  );
}
