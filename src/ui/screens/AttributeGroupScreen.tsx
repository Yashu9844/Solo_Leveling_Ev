import { useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from '@phosphor-icons/react';
import type { AttributeResult } from '../../engine/attributes';
import { localDate } from '../../engine/time';
import { getAttributes } from '../../store/attributes';
import { realDeps } from '../../store/deps';
import { getEngineConfig } from '../../store/engineConfig';
import { useSystem } from '../../store/SystemContext';
import { MeterBar, ScreenTitle } from '../kit';
import { iconFor } from '../presentation/icons';
import { BodyDetailScreen } from './BodyDetailScreen';
import { CraftDetailScreen } from './CraftDetailScreen';
import { MindDetailScreen } from './MindDetailScreen';

/** The bespoke layouts built for the owner's System, by the group `layout` the Blueprint names. */
const LEGACY_LAYOUTS = { body: BodyDetailScreen, mind: MindDetailScreen, craft: CraftDetailScreen } as const;

/**
 * /attributes/:groupId (platform/03 §27.3). The owner's System keeps the three layouts that were
 * designed for it (body, mind, craft - their URLs are unchanged, being the group ids). Any other
 * System gets the generic one below: the group's attributes, each with what it is made of.
 */
export function AttributeGroupScreen() {
  const { groupId } = useParams();
  const { blueprint } = useSystem();
  const group = blueprint.attributes.groups.find((candidate) => candidate.id === groupId);
  if (!group) return <Navigate to="/progress" replace />;
  if (blueprint.origin === 'legacy') {
    const Layout = LEGACY_LAYOUTS[group.layout];
    return <Layout />;
  }
  return <GenericAttributeGroup groupId={group.id} />;
}

function GenericAttributeGroup({ groupId }: { groupId: string }) {
  const navigate = useNavigate();
  const { blueprint } = useSystem();
  const group = blueprint.attributes.groups.find((candidate) => candidate.id === groupId)!;
  const definitions = useMemo(() => blueprint.attributes.defs.filter((definition) => definition.groupId === groupId), [blueprint, groupId]);
  const [results, setResults] = useState<AttributeResult[] | null>(null);
  const Glyph = iconFor(group.icon);

  useEffect(() => {
    let cancelled = false;
    const today = localDate(realDeps.now(), getEngineConfig().arc.timezone, getEngineConfig().arc.dayBoundaryHour);
    void getAttributes(today, getEngineConfig()).then((all) => {
      if (!cancelled) setResults(all);
    });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="px-gutter pb-12 pt-2" data-testid="attribute-group">
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate('/progress')}
          className="flex items-center gap-2 font-mono text-xs font-bold text-accent-mid transition-colors hover:text-accent-bright"
        >
          <ArrowLeft size={16} weight="bold" />
          <span>BACK TO PROGRESS</span>
        </button>
      </div>

      <ScreenTitle title={group.heading} className="mb-1" />
      <div className="mb-4 flex items-center gap-2 text-ink-700">
        <Glyph size={16} weight="fill" color="#5fb2ff" />
        <span className="text-[10px] font-medium uppercase tracking-[0.18em]">{group.tagline}</span>
      </div>

      <div className="flex flex-col gap-3">
        {definitions.map((definition) => {
          const result = results?.find((candidate) => candidate.attribute === definition.id);
          const value = result ? Math.round(result.value) : 0;
          return (
            <div
              key={definition.id}
              className="cut-sm p-3.5"
              style={{
                border: '1px solid rgba(77, 163, 255, 0.28)',
                background: 'linear-gradient(180deg, rgba(10, 20, 36, 0.8), rgba(5, 10, 20, 0.9))',
              }}
            >
              <div className="flex items-baseline justify-between">
                <h3 className="font-display text-lg font-bold tracking-[0.14em] text-ink-100">{definition.name}</h3>
                <span className="font-mono text-sm font-bold tabular-nums text-ink-100">{value}</span>
              </div>
              <MeterBar pct={value} height={7} label={definition.name} className="mt-2 w-full" />
              <p className="mt-2 text-xs leading-relaxed text-ink-500">{definition.description}</p>
              <ul className="mt-2 flex flex-col gap-1">
                {definition.terms.map((term) => (
                  <li key={term.id} className="flex items-center justify-between text-xs text-ink-300">
                    <span>{term.label}</span>
                    <span className="font-mono tabular-nums text-ink-700">
                      {definition.combine === 'sum' ? `${Math.round(term.weight * 100)}%` : '×'}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
