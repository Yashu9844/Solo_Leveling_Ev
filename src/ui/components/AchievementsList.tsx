import { useEffect, useState } from 'react';
import { DEFAULT_CONFIG } from '../../engine/config';
import { localDate } from '../../engine/time';
import { realDeps } from '../../store/deps';
import { getAchievementsReport, type AchievementsReport } from '../../store/achievements';
import { SectionLabel } from '../kit';

/** final/01 §8 — "each a statement of accumulated fact... no achievement
 * for perfect days, perfect weeks, or streak length." final/06's cut
 * list: "achievement gallery (a list on Profile suffices)" — so this is
 * exactly that, earned items only, no locked-item grid. */
export function AchievementsList() {
  const [report, setReport] = useState<AchievementsReport | null>(null);

  useEffect(() => {
    const today = localDate(realDeps.now(), DEFAULT_CONFIG.arc.timezone, DEFAULT_CONFIG.arc.dayBoundaryHour);
    void getAchievementsReport(today, DEFAULT_CONFIG).then(setReport);
  }, []);

  if (!report) return null;
  const earnedAchievements = report.achievements.filter((a) => a.earned);
  const earnedIdentities = report.identities.filter((i) => i.earned);
  if (earnedAchievements.length === 0 && earnedIdentities.length === 0) return null;

  return (
    <div className="mt-6" data-testid="achievements-list">
      {earnedAchievements.length > 0 && (
        <>
          <SectionLabel rule className="mb-2">
            Achievements
          </SectionLabel>
          <Chips labels={earnedAchievements.map((a) => a.label)} />
        </>
      )}
      {earnedIdentities.length > 0 && (
        <>
          <SectionLabel rule className={earnedAchievements.length > 0 ? 'mb-2 mt-5' : 'mb-2'}>
            Identities
          </SectionLabel>
          {/* Identities read louder than achievements on purpose: §8
              makes them statements about who you have become, not about
              what you did. */}
          <Chips labels={earnedIdentities.map((i) => i.label)} tone="identity" />
        </>
      )}
    </div>
  );
}

/**
 * One chip per earned item rather than a single dot-joined sentence.
 *
 * These are discrete facts, and running them together with separators
 * made a five-item list read as one long clause — the eye could not find
 * where one achievement ended and the next began.
 */
function Chips({ labels, tone = 'achievement' }: { labels: string[]; tone?: 'achievement' | 'identity' }) {
  const identity = tone === 'identity';
  return (
    <div className="flex flex-wrap gap-1.5">
      {labels.map((label) => (
        <span
          key={label}
          className={[
            'cut-sm px-3 py-1.5 text-xs',
            identity ? 'text-ink-100' : 'text-ink-500',
          ].join(' ')}
          style={{
            border: `1px solid ${identity ? 'var(--accent)' : 'var(--hair)'}`,
            background: 'var(--surface)',
            boxShadow: identity ? 'var(--glow-sm)' : 'none',
          }}
        >
          {label}
        </span>
      ))}
    </div>
  );
}
