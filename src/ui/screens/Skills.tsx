import { useEffect, useState, useMemo } from 'react';
import {
  Lightning,
  Trophy,
  MagnifyingGlass,
  Flame,
  Star,
  Check,
  type Icon,
} from '@phosphor-icons/react';
import { motion, AnimatePresence } from 'framer-motion';
import type { SkillTreeDef, SystemBlueprint } from '../../blueprint/schema';
import { getEngineConfig } from '../../store/engineConfig';
import { localDate } from '../../engine/time';
import { realDeps } from '../../store/deps';
import { getTreeMastery, type TopicMastery } from '../../store/skills';
import { useSystem } from '../../store/SystemContext';
import type { MasteryState } from '../../engine/types';
import {
  ArtLayer,
  DayMeta,
  PrimaryButton,
  ScreenTitle,
  SegmentBar,
} from '../kit';
import { getActiveArc } from '../../store/arc';
import { LEGACY_CAREER_PANEL, LEGACY_SELF_CERT, LEGACY_SKILLS_SCREEN, LEGACY_TREE_COPY, type TreeCopy } from '../instruments/legacy/skillsCopy';
import { canQuickPractice, quickPractice } from '../instruments/recorders/quickPractice';
import { presentDomain } from '../presentation/domain';
import { iconFor } from '../presentation/icons';
import { FeatureGate } from '../components/FeatureGate';
import { LegacyCareerPanel, MilestonePanel } from '../skills/Panels';
import { genericSelfCertCopy, SelfCertCard } from '../skills/SelfCertCard';

const MASTERY_ORDER: MasteryState[] = ['unseen', 'introduced', 'applied', 'fluent', 'retained'];

const MASTERY_BADGE_STYLE: Record<MasteryState, { label: string; bg: string; border: string; text: string; glow: string }> = {
  unseen: {
    label: 'UNSEEN',
    bg: 'bg-ink-900/40',
    border: 'border-ink-700/30',
    text: 'text-ink-500',
    glow: 'none',
  },
  introduced: {
    label: 'AWAKENED',
    bg: 'bg-blue-950/60',
    border: 'border-blue-500/40',
    text: 'text-blue-400 font-semibold',
    glow: '0 0 8px rgba(59, 130, 246, 0.4)',
  },
  applied: {
    label: 'APPLIED',
    bg: 'bg-cyan-950/70',
    border: 'border-cyan-400/50',
    text: 'text-cyan-300 font-semibold',
    glow: '0 0 10px rgba(34, 211, 238, 0.5)',
  },
  fluent: {
    label: 'FLUENT',
    bg: 'bg-indigo-950/80',
    border: 'border-indigo-400/60',
    text: 'text-indigo-300 font-bold',
    glow: '0 0 12px rgba(129, 140, 248, 0.6)',
  },
  retained: {
    label: 'MONARCH S-RANK',
    bg: 'bg-amber-950/90',
    border: 'border-amber-400/70',
    text: 'text-amber-300 font-extrabold',
    glow: '0 0 16px rgba(251, 191, 36, 0.8)',
  },
};

function TopicRow({
  item,
  index,
  onPractice,
}: {
  item: TopicMastery;
  index: number;
  onPractice?: (topic: string) => void;
}) {
  const filled = MASTERY_ORDER.indexOf(item.state);
  const touched = filled > 0;
  const styleInfo = MASTERY_BADGE_STYLE[item.state] || MASTERY_BADGE_STYLE.unseen;

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2, delay: index * 0.02 }}
      whileHover={{ scale: 1.01, backgroundColor: 'rgba(77, 163, 255, 0.08)' }}
      className="flex items-center gap-2.5 py-2.5 px-3 rounded-sm transition-all duration-150 relative border-b border-hair-faint group"
    >
      {touched && (
        <span
          aria-hidden
          className="absolute left-0 top-1 bottom-1 w-0.5 bg-accent-mid shadow-[0_0_8px_#5fb2ff]"
        />
      )}

      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded border border-accent/20 bg-accent-deep/20 text-accent-mid text-xs font-mono font-bold group-hover:border-accent/50 group-hover:bg-accent-deep/40">
        {String(index + 1).padStart(2, '0')}
      </div>

      {/* Direct child of motion.div so locator('..') reaches the row wrapper */}
      <span
        className={[
          'min-w-0 flex-1 truncate text-xs font-semibold tracking-wide transition-colors',
          touched ? 'text-ink-100 glow-text' : 'text-ink-500',
        ].join(' ')}
      >
        {item.topic}
      </span>

      <span
        className={[
          'shrink-0 rounded border px-2 py-0.5 text-[9px] uppercase tracking-widest font-mono transition-all hidden sm:inline',
          styleInfo.bg,
          styleInfo.border,
          styleInfo.text,
        ].join(' ')}
        style={{ boxShadow: styleInfo.glow }}
      >
        {styleInfo.label}
      </span>

      {/* SegmentBar is a sibling of the topic span — e2e uses aria-label on this */}
      <SegmentBar filled={filled} label={item.state} className="shrink-0" />

      {onPractice && (
        <button
          type="button"
          onClick={() => onPractice(item.topic)}
          className="cut-sm px-2 py-1 text-[10px] font-mono font-bold uppercase tracking-wider text-accent-mid bg-accent-deep/30 border border-accent/40 hover:bg-accent-deep/70 hover:border-accent transition-all flex items-center gap-1 shadow-[0_0_6px_rgba(77,163,255,0.2)] shrink-0"
          title={`Practice ${item.topic}`}
        >
          <Lightning size={11} weight="fill" color="#5fb2ff" />
          <span className="hidden sm:inline">PRACTICE</span>
        </button>
      )}
    </motion.div>
  );
}

type FilterCategory = string;

/** What one skill tree looks like on this screen: the owner's voice where it has one, plain Blueprint names otherwise. */
function treeView(blueprint: SystemBlueprint, tree: SkillTreeDef): TreeCopy {
  const copy = LEGACY_TREE_COPY[tree.id];
  if (blueprint.origin === 'legacy' && copy) return copy;
  const domain = presentDomain(blueprint, tree.domainId);
  const Glyph = domain?.Glyph ?? iconFor(undefined);
  return {
    tab: tree.designation, tabIcon: Glyph, title: tree.name, tagline: domain?.designation ?? tree.designation, sectionIcon: Glyph,
    badge: tree.name, badgeIcon: Glyph, emptyMessage: 'No matching topics found.', inOverall: true,
  };
}

/** The Skills screen opens at the level the System names for it (the owner's: always). */
export function Skills() {
  return (
    <FeatureGate feature="skills">
      <SkillsContent />
    </FeatureGate>
  );
}

function SkillsContent() {
  const { blueprint } = useSystem();
  const legacy = blueprint.origin === 'legacy';
  const trees = blueprint.skills;
  const selfCertMetrics = useMemo(() => blueprint.metrics.filter((metric) => 'manual' in metric.source && metric.unit === 'pass'), [blueprint]);
  const [mastery, setMastery] = useState<Record<string, TopicMastery[]> | null>(null);
  const [day, setDay] = useState<number | null>(null);
  const [arcId, setArcId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<FilterCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [practice, setPractice] = useState<{ tree: SkillTreeDef; topic: string } | null>(null);

  const refreshData = async () => {
    const [overviews, arc] = await Promise.all([
      Promise.all(trees.map(async (tree) => [tree.id, await getTreeMastery(blueprint, tree)] as const)),
      getActiveArc(),
    ]);
    setMastery(Object.fromEntries(overviews));
    if (arc) {
      setArcId(arc.id);
      const dNum = Math.max(1, Math.floor((Date.now() - new Date(arc.start_date).getTime()) / (86400 * 1000)));
      setDay(dNum);
    }
  };

  useEffect(() => {
    void refreshData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blueprint]);

  const views = trees.map((tree) => ({ tree, copy: treeView(blueprint, tree), topics: mastery?.[tree.id] ?? [] }));
  const touched = (topics: TopicMastery[]) => topics.filter((t) => t.state !== 'unseen').length;

  const overall = views.filter((view) => view.copy.inOverall);
  const totalSkillsCount = overall.reduce((sum, view) => sum + view.topics.length, 0);
  const totalTouchedCount = overall.reduce((sum, view) => sum + touched(view.topics), 0);
  const masteryPercentage =
    totalSkillsCount > 0 ? Math.round((totalTouchedCount / totalSkillsCount) * 100) : 0;

  const matches = (topic: string) => !searchQuery.trim() || topic.toLowerCase().includes(searchQuery.toLowerCase());

  const showPanel = legacy || blueprint.milestones.length > 0;
  const panelCopy = legacy ? LEGACY_CAREER_PANEL : { tab: 'MILESTONES', tabIcon: Trophy, title: 'Milestones', tagline: 'WHAT THE ARC IS FOR' };
  const certs = selfCertMetrics.map((metric) => ({ metric, copy: (legacy ? LEGACY_SELF_CERT[metric.id] : undefined) ?? genericSelfCertCopy(metric) }));
  const screen = legacy ? LEGACY_SKILLS_SCREEN : { allTab: 'ALL SKILLS', quote: '', gaugeLabel: 'SKILL MASTERY', searchPlaceholder: 'Search skills...' };

  const tabs: { id: string; label: string; icon: Icon }[] = [
    { id: 'all', label: screen.allTab, icon: Star },
    ...views.map((view) => ({ id: view.tree.id, label: view.copy.tab, icon: view.copy.tabIcon })),
    ...(showPanel ? [{ id: 'panel', label: panelCopy.tab, icon: panelCopy.tabIcon }] : []),
    ...certs.map(({ metric, copy }) => ({ id: metric.id, label: copy.tab, icon: copy.tabIcon })),
  ];
  const searchable = activeTab === 'all' || views.some((view) => view.tree.id === activeTab);

  return (
    <>
      <div className="px-gutter pb-8 pt-2">
        <ScreenTitle title="SKILLS" meta={<DayMeta day={day} of={blueprint.arc.lengthDays} />} className="mb-3" />



        {/* Solo Leveling Hunter Player Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.35, delay: 0.08 }}
          className="cut-md relative mb-4 overflow-hidden p-4 transition-all duration-200"
          style={{
            border: '1px solid rgba(77, 163, 255, 0.5)',
            background: 'linear-gradient(180deg, rgba(10, 20, 36, 0.95), rgba(5, 10, 20, 0.98))',
            boxShadow: '0 0 28px rgba(77, 163, 255, 0.22)',
          }}
        >
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 overflow-hidden"
            style={{
              mixBlendMode: 'lighten',
              opacity: 0.65,
              maskImage: 'radial-gradient(120% 100% at 50% 30%, #000 45%, transparent 88%)',
              WebkitMaskImage: 'radial-gradient(120% 100% at 50% 30%, #000 45%, transparent 88%)',
            }}
          >
            <ArtLayer slot="skills" scrim="none" focal="50% 35%" priority />
          </div>

          <div className="relative z-10">
            {/* The badge row that sat here read "PLAYER STATUS //
                SHADOW MONARCH" beside a gold "LVL {day}" — and that
                number was the *arc day*, not a level, so on day 4 the
                screen told the player they were level 4 when Progress
                said level 1. A wrong number in a loud colour is worse
                than no number, and the quote below is what this panel
                is actually for. */}
            {screen.quote && (
              <p className="text-sm italic leading-relaxed text-ink-100 max-w-[96%]">
                &ldquo;{screen.quote}&rdquo;
              </p>
            )}

            {/* Mana / EXP Progress Gauge Bar */}
            <div className="mt-3 pt-3 border-t border-hair-faint">
              <div className="flex items-center justify-between text-[10px] font-mono font-bold mb-1">
                <span className="text-accent-mid uppercase tracking-widest flex items-center gap-1">
                  <Lightning size={13} weight="fill" color="#5fb2ff" />
                  {screen.gaugeLabel}
                </span>
                <span className="text-ink-100 glow-text">{masteryPercentage}% OVERALL</span>
              </div>
              <div className="h-2.5 w-full rounded-full bg-surface-2 border border-accent/30 overflow-hidden relative p-0.5">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${masteryPercentage}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                  className="h-full rounded-full bg-gradient-to-r from-accent-deep via-accent-mid to-accent-bright shadow-[0_0_12px_#5fb2ff]"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2.5 mt-4">
              {views.map((view) => (
                <BandStat key={view.tree.id} value={touched(view.topics)} total={view.topics.length} label={view.copy.badge} icon={view.copy.badgeIcon} />
              ))}
            </div>
          </div>
        </motion.div>

        {/* Interactive Filter Category Tabs */}
        <div className="mb-4 overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-1.5 p-1 rounded cut-sm border border-accent/25 bg-surface/80 min-w-max">
            {tabs.map((tab) => {
              const IconComp = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={[
                    'relative min-h-tap px-3 text-[10px] font-mono font-bold tracking-wider uppercase rounded transition-all duration-200 flex items-center gap-1.5',
                    isActive ? 'text-ink-100 glow-text font-extrabold' : 'text-ink-700 hover:text-ink-300',
                  ].join(' ')}
                >
                  {isActive && (
                    <motion.div
                      layoutId="activeSkillTab"
                      className="absolute inset-0 cut-sm bg-accent-deep/50 border border-accent/60 shadow-[0_0_12px_rgba(77,163,255,0.35)]"
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    />
                  )}
                  <span className="relative z-10 flex items-center gap-1">
                    <IconComp size={13} weight={isActive ? 'fill' : 'bold'} color={isActive ? '#5fb2ff' : 'currentColor'} />
                    {tab.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Search Bar */}
        {searchable && (
          <div className="mb-4 relative">
            <div className="relative flex items-center">
              <MagnifyingGlass size={16} color="#5fb2ff" className="absolute left-3 drop-shadow-[0_0_6px_#5fb2ff]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={screen.searchPlaceholder}
                className="w-full min-h-tap cut-sm bg-surface-2/90 border border-accent/35 pl-9 pr-4 text-xs font-mono text-ink-100 placeholder:text-ink-700 focus:outline-none focus:border-accent focus:shadow-[0_0_12px_rgba(77,163,255,0.3)] transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 text-xs font-mono text-ink-700 hover:text-accent-mid"
                >
                  CLEAR
                </button>
              )}
            </div>
          </div>
        )}

        <AnimatePresence mode="wait">
          {/* One section per skill tree */}
          {views.filter((view) => activeTab === 'all' || activeTab === view.tree.id).map(({ tree, copy, topics }) => {
            const canPractice = canQuickPractice(blueprint, tree);
            const byTopic = new Map(topics.map((item) => [item.topic, item.state]));
            return (
              <motion.div key={`${tree.id}-sec`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                {copy.tiers ? (
                  <Section title={copy.title} tagline={copy.tagline} icon={copy.sectionIcon}>
                    {copy.tiers.map((tier) => {
                      const matchingItems = searchQuery.trim() ? tier.items.filter(matches) : tier.items;

                      if (searchQuery.trim() && matchingItems.length === 0) return null;

                      return (
                        <div key={tier.title} className="mb-4 last:mb-0 p-3 rounded cut-sm bg-surface/50 border border-hair-faint">
                          <div className="mb-2.5 flex items-center justify-between border-b border-hair-faint pb-1.5">
                            <div className="flex items-center gap-2">
                              <span className="h-1.5 w-1.5 rounded-full bg-accent-mid shadow-[0_0_6px_#5fb2ff]" />
                              <div className="text-xs font-bold uppercase tracking-wider text-accent-mid glow-text">
                                {tier.title}
                              </div>
                            </div>
                            <span className="cut-sm px-2 py-0.5 text-[9px] font-mono font-bold tracking-widest text-amber-300 bg-amber-950/50 border border-amber-500/40 shadow-[0_0_8px_rgba(251,191,36,0.3)]">
                              {tier.rank}
                            </span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {matchingItems.map((item) => {
                              const state = byTopic.get(item) || 'unseen';
                              const styleInfo = MASTERY_BADGE_STYLE[state];
                              return (
                                <motion.div
                                  key={item}
                                  whileHover={{ scale: 1.02, y: -1 }}
                                  className="cut-sm p-2.5 text-xs font-medium text-ink-100 transition-all duration-150 border border-accent/30 bg-surface-2/90 flex items-center justify-between gap-2 shadow-[0_0_10px_rgba(77,163,255,0.1)] hover:border-accent/70 hover:shadow-[0_0_14px_rgba(77,163,255,0.3)]"
                                >
                                  <div className="flex items-center gap-2 min-w-0 flex-1">
                                    <Flame size={14} weight="fill" color="#5fb2ff" className="drop-shadow-[0_0_6px_#5fb2ff] shrink-0" />
                                    <span className="truncate font-semibold text-ink-100">{item}</span>
                                  </div>

                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <span className={['text-[8px] uppercase font-mono font-bold px-1.5 py-0.5 rounded border', styleInfo.bg, styleInfo.border, styleInfo.text].join(' ')}>
                                      {styleInfo.label}
                                    </span>
                                    {canPractice && (
                                      <button
                                        type="button"
                                        onClick={() => setPractice({ tree, topic: item })}
                                        className="px-1.5 py-0.5 text-[9px] font-mono font-bold uppercase tracking-wider text-accent-mid bg-accent-deep/40 border border-accent/40 rounded hover:bg-accent-deep hover:border-accent transition-all flex items-center gap-0.5"
                                        title={`Practice ${item}`}
                                      >
                                        <Lightning size={10} weight="fill" color="#5fb2ff" />
                                        <span>PRACTICE</span>
                                      </button>
                                    )}
                                  </div>
                                </motion.div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </Section>
                ) : (
                  <Section title={copy.title} tagline={copy.tagline} icon={copy.sectionIcon} count={topics.filter((item) => matches(item.topic)).length}>
                    {topics.some((item) => matches(item.topic)) ? (
                      topics.filter((item) => matches(item.topic)).map((item, i) => (
                        <TopicRow
                          key={item.topic}
                          item={item}
                          index={i}
                          onPractice={canPractice ? (topic) => setPractice({ tree, topic }) : undefined}
                        />
                      ))
                    ) : (
                      <p className="text-xs font-mono text-ink-700 py-3 text-center">{copy.emptyMessage}</p>
                    )}
                  </Section>
                )}
              </motion.div>
            );
          })}

          {/* The owner's Career Tree, or a generic System's milestones */}
          {showPanel && (activeTab === 'all' || activeTab === 'panel') && (
            <motion.div key="panel-sec" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <Section title={panelCopy.title} tagline={panelCopy.tagline} icon={panelCopy.tabIcon}>
                {legacy ? (
                  <LegacyCareerPanel
                    foundationsTouched={touched(mastery?.foundations ?? [])}
                    aiTouched={touched(mastery?.ai ?? [])}
                  />
                ) : (
                  <MilestonePanel />
                )}
              </Section>
            </motion.div>
          )}

          {/* Self-certified metrics (the owner's: the Dungeon Gate benchmark) */}
          {certs.filter(({ metric }) => activeTab === 'all' || activeTab === metric.id).map(({ metric, copy }) => (
            <motion.div key={`${metric.id}-sec`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <Section title={copy.title} tagline={copy.tagline} icon={copy.glyph}>
                <SelfCertCard metric={metric} copy={copy} />
              </Section>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Quick Skill Practice Modal */}
      {practice && arcId && (
        <QuickPracticeModal
          blueprint={blueprint}
          tree={practice.tree}
          topic={practice.topic}
          arcId={arcId}
          onClose={() => setPractice(null)}
          onSaved={() => {
            setPractice(null);
            void refreshData();
          }}
        />
      )}
    </>
  );
}

function BandStat({ value, total, label, icon: Glyph }: { value: number; total: number; label: string; icon: Icon }) {
  return (
    <div className="flex items-center gap-2 p-2 rounded cut-sm border border-accent/20 bg-surface/50">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[6px] border border-accent/40 bg-accent-deep/40 text-accent-mid shadow-[0_0_10px_rgba(77,163,255,0.35)]">
        <Glyph size={15} weight="fill" color="#5fb2ff" />
      </div>
      <div className="min-w-0">
        <div className="font-mono text-sm font-bold leading-none tabular-nums text-ink-100">
          <span className="glow-text text-accent-mid">{value}</span>
          <span className="text-[10px] text-ink-700"> / {total}</span>
        </div>
        <div className="text-[8px] uppercase font-mono font-bold tracking-wider text-ink-700 mt-0.5 truncate">{label}</div>
      </div>
    </div>
  );
}

function Section({
  title,
  tagline,
  icon: Glyph,
  count,
  children,
}: {
  title: string;
  tagline?: string;
  icon?: Icon;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="cut-sm mb-4 p-4 transition-all duration-200"
      style={{
        border: '1px solid rgba(77, 163, 255, 0.35)',
        background: 'linear-gradient(180deg, rgba(10, 20, 36, 0.88), rgba(5, 10, 20, 0.96))',
        boxShadow: '0 0 18px rgba(77, 163, 255, 0.12)',
      }}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-hair-faint pb-2">
        <div className="flex min-w-0 items-center gap-2.5">
          {Glyph && (
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[6px] border border-accent/40 bg-accent-deep/40 text-accent-mid shadow-[0_0_8px_rgba(77,163,255,0.3)]">
              <Glyph size={15} weight="fill" color="#5fb2ff" />
            </div>
          )}
          <div>
            <h2 className="font-display text-lg font-bold tracking-[0.14em] text-ink-100 flex items-center gap-2">
              {title}
              {count !== undefined && (
                <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-accent-deep/40 border border-accent/30 text-accent-mid">
                  {count}
                </span>
              )}
            </h2>
          </div>
        </div>
        {tagline && (
          <span className="text-[9px] uppercase tracking-[0.18em] font-bold text-accent-mid/80 font-mono">
            {tagline}
          </span>
        )}
      </div>
      {children}
    </motion.div>
  );
}

function QuickPracticeModal({
  blueprint,
  tree,
  topic,
  arcId,
  onClose,
  onSaved,
}: {
  blueprint: SystemBlueprint;
  tree: SkillTreeDef;
  topic: string;
  arcId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [minutes, setMinutes] = useState(30);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      const todayStr = localDate(realDeps.now(), getEngineConfig().arc.timezone, getEngineConfig().arc.dayBoundaryHour);
      await quickPractice(blueprint, tree, topic, minutes, note || undefined, { today: todayStr, arcId });
      onSaved();
    } catch {
      alert('Could not save practice trial.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-950/80 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-md cut-md p-5 border border-accent/50 bg-surface-2/95 shadow-[0_0_30px_rgba(77,163,255,0.3)] relative"
      >
        <div className="flex items-center justify-between mb-4 border-b border-hair-faint pb-3">
          <div className="flex items-center gap-2">
            <Lightning size={18} weight="fill" color="#5fb2ff" className="animate-pulse drop-shadow-[0_0_8px_#5fb2ff]" />
            <h3 className="font-display text-base font-bold uppercase tracking-wider text-ink-100">
              PRACTICE SPELL // {topic}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-xs font-mono text-ink-700 hover:text-ink-100 uppercase"
          >
            CANCEL
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)}>
          <div className="mb-4">
            <label className="block text-[10px] font-mono font-bold uppercase tracking-widest text-accent-mid mb-1.5">
              PRACTICE DURATION (MINUTES)
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[15, 30, 45, 60].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMinutes(m)}
                  className={[
                    'min-h-tap cut-sm text-xs font-mono font-bold border transition-all',
                    minutes === m
                      ? 'bg-accent-deep/50 border-accent text-ink-100 shadow-[0_0_10px_rgba(77,163,255,0.4)]'
                      : 'bg-surface/50 border-hair-faint text-ink-500 hover:border-accent/40',
                  ].join(' ')}
                >
                  {m} MIN
                </button>
              ))}
            </div>
          </div>

          <div className="mb-5">
            <label className="block text-[10px] font-mono font-bold uppercase tracking-widest text-accent-mid mb-1.5">
              TRIAL NOTES / INSIGHTS (OPTIONAL)
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="E.g., Mastered sliding window pointers, solved 2 medium problems..."
              className="w-full cut-sm bg-surface/80 border border-accent/35 p-3 text-xs font-mono text-ink-100 placeholder:text-ink-700 focus:outline-none focus:border-accent min-h-[80px]"
            />
          </div>

          <div className="p-3 mb-5 rounded cut-sm border border-emerald-500/30 bg-emerald-950/30 text-[11px] font-mono text-emerald-300 flex items-center gap-2">
            <Check size={14} color="#34d399" />
            <span>This practice will auto-fill your Skill level and sync with Today&rsquo;s Learning log!</span>
          </div>

          <div className="flex gap-2">
            <PrimaryButton
              type="submit"
              disabled={submitting}
              className="flex-1 font-mono uppercase font-bold tracking-wider shadow-[0_0_16px_rgba(77,163,255,0.4)]"
            >
              {submitting ? 'LOGGING...' : '⚡ RECORD PRACTICE & ADVANCE'}
            </PrimaryButton>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
