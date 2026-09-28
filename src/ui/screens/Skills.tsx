import { useEffect, useState, useMemo } from 'react';
import {
  Code,
  Cpu,
  Lightning,
  Sparkle,
  Sword,
  Trophy,
  MagnifyingGlass,
  CheckCircle,
  Flame,
  Star,
  Check,
  type Icon,
} from '@phosphor-icons/react';
import { motion, AnimatePresence } from 'framer-motion';
import { DEFAULT_CONFIG } from '../../engine/config';
import { localDate } from '../../engine/time';
import { realDeps } from '../../store/deps';
import { db } from '../../db/db';
import {
  getDsaSkillsOverview,
  getFoundationSkillsOverview,
  getAiSkillsOverview,
  getCareerTreeOverview,
  logQuickSkillPractice,
  type TopicMastery,
  type CareerTreeOverview,
} from '../../store/skills';
import {
  getInterviewBenchmarkHistory,
  getInterviewBenchmarkPassed,
  logInterviewBenchmark,
} from '../../store/training';
import type { MasteryState } from '../../engine/types';
import {
  ArtLayer,
  DayMeta,
  FramedPanel,
  PrimaryButton,
  ScreenTitle,
  SecondaryButton,
  SegmentBar,
} from '../kit';

const ARC_LENGTH_DAYS = 120;

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
  onPractice: (topic: string) => void;
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

      <button
        type="button"
        onClick={() => onPractice(item.topic)}
        className="cut-sm px-2 py-1 text-[10px] font-mono font-bold uppercase tracking-wider text-accent-mid bg-accent-deep/30 border border-accent/40 hover:bg-accent-deep/70 hover:border-accent transition-all flex items-center gap-1 shadow-[0_0_6px_rgba(77,163,255,0.2)] shrink-0"
        title={`Practice ${item.topic}`}
      >
        <Lightning size={11} weight="fill" color="#5fb2ff" />
        <span className="hidden sm:inline">PRACTICE</span>
      </button>
    </motion.div>
  );
}

const AI_TIERS: { title: string; subtitle: string; rank: string; items: string[] }[] = [
  {
    title: 'Tier 0 — Table Stakes',
    subtitle: 'CORE FOUNDATIONS',
    rank: 'E-RANK',
    items: [
      'LLM Fundamentals',
      'Prompting with Cache-Awareness',
      'Structured Outputs',
      'Tool Calling',
      'Embeddings',
      'RAG Basics',
      'Vector Store Selection',
      'Model Landscape & Pricing',
    ],
  },
  {
    title: 'Tier 1 — Differentiators',
    subtitle: 'ADVANCED CAPABILITIES',
    rank: 'B-RANK',
    items: ['Evaluation Design', 'Agent Orchestration', 'Context Engineering', 'MCP Protocol', 'Cost & Latency Optimization'],
  },
  {
    title: 'Tier 2 — Production Engine',
    subtitle: 'PRODUCTION ARCHITECTURES',
    rank: 'A-RANK',
    items: [
      'Observability & Tracing',
      'Guardrails & OWASP LLM Risks',
      'Sandboxing & Kill-Switches',
      'Production Deployment',
      'Async Job Architecture',
    ],
  },
  {
    title: 'Tier 3 — Frontier Tier',
    subtitle: 'MONARCH ARCHITECTURES',
    rank: 'S-RANK',
    items: ['Multi-Agent Coordination', 'Computer-Use / Vision-Action Loops', 'Custom Fine-Tuning'],
  },
];

type FilterCategory = 'all' | 'dsa' | 'foundations' | 'ai' | 'career' | 'benchmark';

export function Skills() {
  const [dsa, setDsa] = useState<TopicMastery[] | null>(null);
  const [foundations, setFoundations] = useState<TopicMastery[] | null>(null);
  const [aiSkills, setAiSkills] = useState<TopicMastery[] | null>(null);
  const [careerTree, setCareerTree] = useState<CareerTreeOverview | null>(null);
  const [day, setDay] = useState<number | null>(null);
  const [arcId, setArcId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<FilterCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [practiceTopic, setPracticeTopic] = useState<string | null>(null);

  const refreshData = async () => {
    const [d, f, ai, c, arc] = await Promise.all([
      getDsaSkillsOverview(),
      getFoundationSkillsOverview(),
      getAiSkillsOverview(),
      getCareerTreeOverview(),
      db.arc.toCollection().first(),
    ]);
    setDsa(d);
    setFoundations(f);
    setAiSkills(ai);
    setCareerTree(c);
    if (arc) {
      setArcId(arc.id);
      const dNum = Math.max(1, Math.floor((Date.now() - new Date(arc.start_date).getTime()) / (86400 * 1000)));
      setDay(dNum);
    }
  };

  useEffect(() => {
    void refreshData();
  }, []);

  const dsaTouched = dsa?.filter((t) => t.state !== 'unseen').length ?? 0;
  const foundationsTouched = foundations?.filter((t) => t.state !== 'unseen').length ?? 0;
  const aiTouched = aiSkills?.filter((t) => t.state !== 'unseen').length ?? 0;

  const totalSkillsCount = (dsa?.length ?? 0) + (foundations?.length ?? 0);
  const totalTouchedCount = dsaTouched + foundationsTouched;
  const masteryPercentage =
    totalSkillsCount > 0 ? Math.round((totalTouchedCount / totalSkillsCount) * 100) : 0;

  const filteredDsa = useMemo(() => {
    if (!dsa) return [];
    if (!searchQuery.trim()) return dsa;
    return dsa.filter((t) => t.topic.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [dsa, searchQuery]);

  const filteredFoundations = useMemo(() => {
    if (!foundations) return [];
    if (!searchQuery.trim()) return foundations;
    return foundations.filter((t) => t.topic.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [foundations, searchQuery]);

  const aiMap = useMemo(() => {
    const map = new Map<string, MasteryState>();
    aiSkills?.forEach((item) => map.set(item.topic, item.state));
    return map;
  }, [aiSkills]);

  return (
    <>
      <div className="px-gutter pb-8 pt-2">
        <ScreenTitle title="SKILLS" meta={<DayMeta day={day} of={ARC_LENGTH_DAYS} />} className="mb-3" />



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
            <p className="text-sm italic leading-relaxed text-ink-100 max-w-[96%]">
              &ldquo;Skills are not granted by favour. They are forged in the dungeon of
              unyielding discipline.&rdquo;
            </p>

            {/* Mana / EXP Progress Gauge Bar */}
            <div className="mt-3 pt-3 border-t border-hair-faint">
              <div className="flex items-center justify-between text-[10px] font-mono font-bold mb-1">
                <span className="text-accent-mid uppercase tracking-widest flex items-center gap-1">
                  <Lightning size={13} weight="fill" color="#5fb2ff" />
                  MANA &amp; SPELL MASTERY
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
              <BandStat value={dsaTouched} total={dsa?.length ?? 0} label="DSA Power" icon={Code} />
              <BandStat value={foundationsTouched} total={foundations?.length ?? 0} label="SE Architect" icon={Cpu} />
              <BandStat value={aiTouched} total={AI_TIERS.reduce((acc, t) => acc + t.items.length, 0)} label="AI Spells" icon={Sparkle} />
            </div>
          </div>
        </motion.div>

        {/* Interactive Filter Category Tabs */}
        <div className="mb-4 overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-1.5 p-1 rounded cut-sm border border-accent/25 bg-surface/80 min-w-max">
            {[
              { id: 'all', label: 'ALL SPELLS', icon: Star },
              { id: 'dsa', label: 'DSA POWER', icon: Code },
              { id: 'foundations', label: 'ARCHITECT', icon: Cpu },
              { id: 'ai', label: 'AI SPELLS', icon: Sparkle },
              { id: 'career', label: 'CAREER PATH', icon: Trophy },
              { id: 'benchmark', label: 'DUNGEON GATE', icon: Sword },
            ].map((tab) => {
              const IconComp = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as FilterCategory)}
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
        {(activeTab === 'all' || activeTab === 'dsa' || activeTab === 'foundations' || activeTab === 'ai') && (
          <div className="mb-4 relative">
            <div className="relative flex items-center">
              <MagnifyingGlass size={16} color="#5fb2ff" className="absolute left-3 drop-shadow-[0_0_6px_#5fb2ff]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search skills, algorithms, architecture, AI spells..."
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
          {/* Section 1: DSA */}
          {(activeTab === 'all' || activeTab === 'dsa') && (
            <motion.div key="dsa-sec" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <Section title="DSA Algorithmic Power" tagline="CORE SPELLS" icon={Code} count={filteredDsa.length}>
                {filteredDsa.length > 0 ? (
                  filteredDsa.map((item, i) => (
                    <TopicRow
                      key={item.topic}
                      item={item}
                      index={i}
                      onPractice={(topic) => setPracticeTopic(topic)}
                    />
                  ))
                ) : (
                  <p className="text-xs font-mono text-ink-700 py-3 text-center">No matching algorithms found.</p>
                )}
              </Section>
            </motion.div>
          )}

          {/* Section 2: SE Foundations */}
          {(activeTab === 'all' || activeTab === 'foundations') && (
            <motion.div key="foundations-sec" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <Section title="SE Foundations" tagline="SYSTEM ARCHITECTURE" icon={Cpu} count={filteredFoundations.length}>
                {filteredFoundations.length > 0 ? (
                  filteredFoundations.map((item, i) => (
                    <TopicRow
                      key={item.topic}
                      item={item}
                      index={i}
                      onPractice={(topic) => setPracticeTopic(topic)}
                    />
                  ))
                ) : (
                  <p className="text-xs font-mono text-ink-700 py-3 text-center">No matching architecture topics found.</p>
                )}
              </Section>
            </motion.div>
          )}

          {/* Section 3: AI / Agentic Tiers */}
          {(activeTab === 'all' || activeTab === 'ai') && (
            <motion.div key="ai-sec" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <Section title="AI / Agentic Spells" tagline="FRONTIER TECH TIERS" icon={Sparkle}>
                {AI_TIERS.map((tier) => {
                  const matchingItems = searchQuery.trim()
                    ? tier.items.filter((item) => item.toLowerCase().includes(searchQuery.toLowerCase()))
                    : tier.items;

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
                          const state = aiMap.get(item) || 'unseen';
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
                                <button
                                  type="button"
                                  onClick={() => setPracticeTopic(item)}
                                  className="px-1.5 py-0.5 text-[9px] font-mono font-bold uppercase tracking-wider text-accent-mid bg-accent-deep/40 border border-accent/40 rounded hover:bg-accent-deep hover:border-accent transition-all flex items-center gap-0.5"
                                  title={`Practice ${item}`}
                                >
                                  <Lightning size={10} weight="fill" color="#5fb2ff" />
                                  <span>PRACTICE</span>
                                </button>
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </Section>
            </motion.div>
          )}

          {/* Section 4: Career Tree */}
          {(activeTab === 'all' || activeTab === 'career') && careerTree && (
            <motion.div key="career-sec" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <Section title="Career Tree" tagline="ARTEFACTS & INTERVIEWS" icon={Trophy}>
                <TreeRow label="Software engineering → foundations" value={`${foundationsTouched}/9`} />
                <TreeRow label="AI / Agentic → tiers unlocked" value={`${aiTouched}/21 Tiers Active`} />
                <TreeRow
                  label="Projects → artifacts"
                  value={
                    Object.entries(careerTree.artifactsByKind)
                      .filter(([, n]) => (n ?? 0) > 0)
                      .map(([kind, n]) => `${n} ${kind}`)
                      .join(' · ') || '0'
                  }
                />
                <TreeRow label="Resume → versions" value={String(careerTree.resumeVersions)} />
                <TreeRow
                  label="Applications Logged"
                  value={`${careerTree.applications} (${careerTree.qualityApplications} quality)`}
                />
                <TreeRow label="Interviews Conducted" value={String(careerTree.interviews)} />
                <TreeRow label="Offer Secured" value={String(careerTree.offers)} />
              </Section>
            </motion.div>
          )}

          {/* Section 5: Dungeon Gate Benchmark */}
          {(activeTab === 'all' || activeTab === 'benchmark') && (
            <motion.div key="benchmark-sec" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <Section title="Interview Readiness Benchmark" tagline="S-RANK DUNGEON GATE" icon={Sword}>
                <InterviewBenchmarkCard />
              </Section>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Quick Skill Practice Modal */}
      {practiceTopic && arcId && (
        <QuickPracticeModal
          topic={practiceTopic}
          arcId={arcId}
          onClose={() => setPracticeTopic(null)}
          onSaved={() => {
            setPracticeTopic(null);
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

function TreeRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 py-2.5 px-2 rounded-sm transition-all duration-150 hover:bg-accent-deep/15 border-b border-hair-faint">
      <span className="min-w-0 flex-1 truncate text-xs font-semibold text-ink-300">{label}</span>
      <span className="shrink-0 font-mono text-xs font-bold tabular-nums text-accent-mid glow-text">{value}</span>
    </div>
  );
}

function InterviewBenchmarkCard() {
  const [passed, setPassed] = useState<boolean | null>(null);
  const [history, setHistory] = useState<{ local_date: string; passed: boolean }[]>([]);
  const [arcId, setArcId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function refresh() {
    const [p, h, arc] = await Promise.all([getInterviewBenchmarkPassed(), getInterviewBenchmarkHistory(), db.arc.toCollection().first()]);
    setPassed(p);
    setHistory(h);
    setArcId(arc?.id ?? null);
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function handleLog(didPass: boolean) {
    if (!arcId || submitting) return;
    setSubmitting(true);
    try {
      const today = localDate(realDeps.now(), DEFAULT_CONFIG.arc.timezone, DEFAULT_CONFIG.arc.dayBoundaryHour);
      await logInterviewBenchmark(today, arcId, didPass, DEFAULT_CONFIG, realDeps);
      await refresh();
    } finally {
      setSubmitting(false);
    }
  }

  if (!arcId) return null;

  return (
    <FramedPanel className="px-4 py-4 relative overflow-hidden cut-sm border border-accent/40 bg-surface-2/90 shadow-[0_0_20px_rgba(77,163,255,0.2)]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-25"
        style={{
          mixBlendMode: 'lighten',
          maskImage: 'radial-gradient(100% 100% at 50% 50%, #000 20%, transparent 80%)',
          WebkitMaskImage: 'radial-gradient(100% 100% at 50% 50%, #000 20%, transparent 80%)',
        }}
      >
        <ArtLayer slot="training" scrim="quiet" focal="50% 40%" />
      </div>

      <div className="relative z-10">
        <div className="flex items-center gap-2 mb-2">
          <Sword size={16} weight="fill" color="#5fb2ff" className="animate-bounce drop-shadow-[0_0_8px_#5fb2ff]" />
          <span className="text-xs font-mono font-bold uppercase tracking-wider text-ink-100">
            DUNGEON GATE PROTOCOL RULES
          </span>
        </div>

        <p className="text-xs leading-relaxed text-ink-200 font-medium">
          3 randomly-drawn medium DSA challenges · 90 minutes total duration · unseen test cases · first-attempt working solution with full space-time complexity analysis.
        </p>

        <div className="mt-4 p-2.5 rounded cut-sm border border-accent/30 bg-accent-deep/20 flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-widest font-mono text-ink-500 font-bold">BENCHMARK GATE STATUS:</span>
          <div className="flex items-center gap-1.5">
            <CheckCircle size={15} weight="fill" color={passed ? '#5fb2ff' : '#90a8c2'} />
            <p className={['text-xs font-bold tracking-wider uppercase font-mono', passed ? 'glow-text text-accent-mid font-extrabold' : 'text-ink-500'].join(' ')}>
              {passed ? '✓ GATE CLEARED' : 'UNCLEARED GATE'}
            </p>
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <PrimaryButton size="md" disabled={submitting} onClick={() => void handleLog(true)} className="flex-1 shadow-[0_0_16px_rgba(77,163,255,0.4)] font-mono uppercase font-bold tracking-wider">
            {submitting ? 'RECORDING...' : 'GATE CLEARED'}
          </PrimaryButton>
          <SecondaryButton disabled={submitting} onClick={() => void handleLog(false)} className="flex-1 font-mono uppercase tracking-wider">
            RETRIED / FAILED
          </SecondaryButton>
        </div>

        {history.length > 0 && (
          <ul className="mt-4 flex flex-col gap-1.5 border-t border-hair-faint pt-3">
            <div className="text-[9px] uppercase font-mono font-bold text-ink-700 tracking-wider mb-1">
              DUNGEON ENTRY LOGS ({history.length})
            </div>
            {history.map((h, i) => (
              <li
                key={i}
                className="flex items-center justify-between font-mono text-xxs tabular-nums px-2 py-1 rounded bg-surface/50 border border-hair-faint"
              >
                <span className="text-ink-500">{h.local_date}</span>
                <span className={h.passed ? 'text-accent-mid font-bold glow-text uppercase' : 'text-ink-700 uppercase'}>
                  {h.passed ? '✓ CLEARED' : 'RETRIED'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </FramedPanel>
  );
}

function QuickPracticeModal({
  topic,
  arcId,
  onClose,
  onSaved,
}: {
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
      const todayStr = localDate(realDeps.now(), DEFAULT_CONFIG.arc.timezone, DEFAULT_CONFIG.arc.dayBoundaryHour);
      await logQuickSkillPractice(todayStr, arcId, topic, minutes, DEFAULT_CONFIG, realDeps, note || undefined);
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
