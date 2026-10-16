import { useState } from 'react';
import type { OptionDef, Tier } from '../../../onboarding/types';
import { PrimaryButton, SafeTop, ScreenShell } from '../../kit';
import { StepConsole } from '../shared';
import { Cards } from './QuestionView';

const TIERS: (OptionDef & { value: Tier })[] = [
  { value: 'guided', label: 'Guided', hint: 'About eight minutes. A few questions about each area, so the System fits you closely.' },
  { value: 'quick', label: 'Quick awakening', hint: 'About two minutes. Your name, your areas and your rhythm; the rest from sensible defaults.' },
];

/** The first screen of a new arc: how much to say. Either way the System that comes out is complete. */
export function TierChoice({ onChoose }: { onChoose: (tier: Tier) => void }) {
  const [tier, setTier] = useState<Tier>('guided');
  return (
    <ScreenShell>
      <div className="relative flex flex-1 flex-col overflow-hidden text-ink-100">
        <div aria-hidden className="init-field pointer-events-none absolute inset-0 overflow-hidden" />
        <div className="relative flex min-h-0 flex-1 flex-col">
          <SafeTop />
          <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-gutter pb-4 pt-6" data-testid="tier-choice">
            <StepConsole index={0} kicker="AWAKENING" title="HOW MUCH DO YOU WANT TO TELL THE SYSTEM?" lead="Either way you are given a complete System, and everything in it can be adjusted afterwards.">
              <Cards options={TIERS} selected={[tier]} multiple={false} onToggle={(value) => setTier(value as Tier)} />
            </StepConsole>
          </div>
          <div className="relative flex gap-3 px-gutter pt-2" style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 16px)' }}>
            <PrimaryButton size="md" onClick={() => onChoose(tier)} className="flex-1">Begin</PrimaryButton>
          </div>
        </div>
      </div>
    </ScreenShell>
  );
}
