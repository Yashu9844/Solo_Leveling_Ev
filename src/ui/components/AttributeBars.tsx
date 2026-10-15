import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CaretRight } from '@phosphor-icons/react';
import { getEngineConfig } from '../../store/engineConfig';
import { localDate } from '../../engine/time';
import { realDeps } from '../../store/deps';
import { getAttributes } from '../../store/attributes';
import { useSystem } from '../../store/SystemContext';
import type { AttributeResult } from '../../engine/attributes';
import { iconFor } from '../presentation/icons';
import { MeterBar } from '../kit';

function Bar({ result, label }: { result: AttributeResult; label: string }) {
  const value = Math.round(result.value);
  return (
    <div className="flex items-center gap-3 py-1.5">
      <span className="w-[110px] shrink-0 text-xs font-semibold uppercase tracking-wider text-ink-700">
        {label}
      </span>
      <MeterBar pct={value} height={7} label={label} className="min-w-0 flex-1" />
      <span className="w-6 shrink-0 text-right font-mono text-xs font-bold tabular-nums text-ink-100">
        {value}
      </span>
    </div>
  );
}

/** All 0-100, non-editable, 28-day rolling window — final/01 §5. Cut-corner HUD cards matching the Progress design screenshot */
export function AttributeBars() {
  const navigate = useNavigate();
  const { blueprint } = useSystem();
  // The Blueprint's groups, each with the attributes assigned to it; a group nothing is assigned to is not shown.
  const groups = useMemo(
    () => blueprint.attributes.groups
      .map((group) => ({ ...group, attributes: blueprint.attributes.defs.filter((definition) => definition.groupId === group.id) }))
      .filter((group) => group.attributes.length > 0),
    [blueprint]
  );
  const [results, setResults] = useState<AttributeResult[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    const today = localDate(realDeps.now(), getEngineConfig().arc.timezone, getEngineConfig().arc.dayBoundaryHour);
    void getAttributes(today, getEngineConfig()).then((r) => {
      if (!cancelled) setResults(r);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!results) return null;
  const byAttribute = new Map<string, AttributeResult>(results.map((r) => [r.attribute, r]));

  return (
    <div className="mt-4 flex flex-col gap-3" data-testid="attribute-bars">
      {groups.map((group) => {
        const Glyph = iconFor(group.icon);
        return (
          <div
            key={group.id}
            onClick={() => navigate(`/attributes/${group.id}`)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') navigate(`/attributes/${group.id}`);
            }}
            className="cut-sm p-3.5 transition-all duration-200 cursor-pointer group hover:border-accent/80 hover:shadow-[0_0_20px_rgba(77,163,255,0.25)]"
            style={{
              border: '1px solid rgba(77, 163, 255, 0.28)',
              background: 'linear-gradient(180deg, rgba(10, 20, 36, 0.8), rgba(5, 10, 20, 0.9))',
              boxShadow: '0 0 14px rgba(77, 163, 255, 0.08)',
            }}
          >
            {/* Header of Attribute Card */}
            <div className="flex items-center justify-between gap-3 mb-2.5 pb-2 border-b border-hair-faint">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[7px] border border-accent/40 bg-accent-deep/30 text-accent-mid shadow-[0_0_8px_rgba(77,163,255,0.3)] group-hover:border-accent group-hover:scale-105 transition-all">
                  <Glyph size={18} weight="fill" color="#5fb2ff" />
                </div>
                <h3 className="font-display text-lg font-bold tracking-[0.14em] text-ink-100 group-hover:text-accent-bright transition-colors">
                  {group.heading}
                </h3>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-[9px] uppercase tracking-[0.18em] font-medium text-ink-700 group-hover:text-accent-mid transition-colors">
                  {group.tagline}
                </span>
                <CaretRight size={14} weight="bold" className="text-ink-700 group-hover:text-accent-bright group-hover:translate-x-0.5 transition-all" />
              </div>
            </div>

            {/* Attribute Rows */}
            <div className="flex flex-col gap-1">
              {group.attributes.map((definition) => {
                const result = byAttribute.get(definition.id);
                return result ? <Bar key={definition.id} result={result} label={definition.name} /> : null;
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

