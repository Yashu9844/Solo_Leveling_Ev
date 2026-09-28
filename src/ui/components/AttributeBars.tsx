import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Barbell, Brain, Cpu, CaretRight, type Icon } from '@phosphor-icons/react';
import { DEFAULT_CONFIG } from '../../engine/config';
import { localDate } from '../../engine/time';
import { realDeps } from '../../store/deps';
import { getAttributes } from '../../store/attributes';
import type { AttributeResult } from '../../engine/attributes';
import type { Attribute } from '../../engine/types';
import { MeterBar } from '../kit';

const ATTRIBUTE_LABELS: Record<Attribute, string> = {
  DISCIPLINE: 'DISCIPLINE',
  DEPTH: 'DEPTH',
  PROBLEM_SOLVING: 'PROBLEM SOLVING',
  ENGINEERING: 'ENGINEERING',
  MOMENTUM: 'MOMENTUM',
  VITALITY: 'VITALITY',
};

const GROUPS: {
  heading: string;
  tagline: string;
  icon: Icon;
  route: string;
  attributes: Attribute[];
}[] = [
  {
    heading: 'MIND',
    tagline: 'A SHARPER YOU',
    icon: Brain,
    route: '/attributes/mind',
    attributes: ['DISCIPLINE', 'DEPTH', 'PROBLEM_SOLVING'],
  },
  {
    heading: 'CRAFT',
    tagline: 'BUILD SKILLS. BUILD OPTIONS.',
    icon: Cpu,
    route: '/attributes/craft',
    attributes: ['ENGINEERING', 'MOMENTUM'],
  },
  {
    heading: 'BODY',
    tagline: 'A STRONGER YOU',
    icon: Barbell,
    route: '/attributes/body',
    attributes: ['VITALITY'],
  },
];

function Bar({ result }: { result: AttributeResult }) {
  const value = Math.round(result.value);
  return (
    <div className="flex items-center gap-3 py-1.5">
      <span className="w-[110px] shrink-0 text-xs font-semibold uppercase tracking-wider text-ink-700">
        {ATTRIBUTE_LABELS[result.attribute]}
      </span>
      <MeterBar pct={value} height={7} label={ATTRIBUTE_LABELS[result.attribute]} className="min-w-0 flex-1" />
      <span className="w-6 shrink-0 text-right font-mono text-xs font-bold tabular-nums text-ink-100">
        {value}
      </span>
    </div>
  );
}

/** All 0-100, non-editable, 28-day rolling window — final/01 §5. Cut-corner HUD cards matching the Progress design screenshot */
export function AttributeBars() {
  const navigate = useNavigate();
  const [results, setResults] = useState<AttributeResult[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    const today = localDate(realDeps.now(), DEFAULT_CONFIG.arc.timezone, DEFAULT_CONFIG.arc.dayBoundaryHour);
    void getAttributes(today, DEFAULT_CONFIG).then((r) => {
      if (!cancelled) setResults(r);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!results) return null;
  const byAttribute = new Map(results.map((r) => [r.attribute, r]));

  return (
    <div className="mt-4 flex flex-col gap-3" data-testid="attribute-bars">
      {GROUPS.map((group) => {
        const Glyph = group.icon;
        return (
          <div
            key={group.heading}
            onClick={() => navigate(group.route)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') navigate(group.route);
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
              {group.attributes.map((attribute) => {
                const result = byAttribute.get(attribute);
                return result ? <Bar key={attribute} result={result} /> : null;
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

