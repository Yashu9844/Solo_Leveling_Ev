import { useMemo, type ComponentType } from 'react';
import type { InstrumentType } from '../../blueprint/schema';
import { useSystem } from '../../store/SystemContext';
import { ArtifactSheet } from './ArtifactSheet';
import { DurationSheet } from './DurationSheet';
import { PipelineSheet } from './PipelineSheet';
import { PracticeItemSheet } from './PracticeItemSheet';
import { SessionSheet } from './SessionSheet';
import type { InstrumentSheetProps } from './types';

/**
 * Which sheet logs which kind of instrument (platform/03 §27.2). Filled in as each
 * type is extracted from its bespoke legacy sheet (loops 7.2-7.4); a type with no
 * entry yet is still opened by the legacy sheet its screen has always used.
 */
export const INSTRUMENT_SHEETS: Partial<Record<InstrumentType, ComponentType<InstrumentSheetProps>>> = {
  practice_item: PracticeItemSheet,
  pipeline: PipelineSheet,
  duration: DurationSheet,
  artifact: ArtifactSheet,
  session: SessionSheet,
};

interface DomainLogSheetProps {
  domainId: string;
  today: string;
  arcId: string;
  onClose: () => void;
}

/**
 * Opens the primary log sheet of a domain: the first of its instruments whose type
 * has a sheet in the registry, with the domain's other instruments as siblings
 * (the duration beside a pipeline is its substitute tab). Renders nothing when the
 * domain, or a sheet for it, does not exist.
 */
export function DomainLogSheet({ domainId, today, arcId, onClose }: DomainLogSheetProps) {
  const { blueprint } = useSystem();
  const target = useMemo(() => {
    const domain = blueprint.domains.find((candidate) => candidate.id === domainId);
    if (!domain) return undefined;
    const instruments = domain.instrumentIds.flatMap((id) => blueprint.instruments.find((candidate) => candidate.id === id) ?? []);
    const primary = instruments.find((instrument) => INSTRUMENT_SHEETS[instrument.type]);
    return primary ? { domain, primary, siblings: instruments.filter((instrument) => instrument !== primary) } : undefined;
  }, [blueprint, domainId]);

  if (!target) return null;
  const Sheet = INSTRUMENT_SHEETS[target.primary.type]!;
  return <Sheet instrument={target.primary} domain={target.domain} siblings={target.siblings} today={today} arcId={arcId} onClose={onClose} />;
}
