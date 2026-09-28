import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Brain,
  ArrowLeft,
  BookOpen,
  Sparkle,
  CheckCircle,
} from '@phosphor-icons/react';
import { ArtLayer, ScreenTitle } from '../kit';
import { localDate } from '../../engine/time';
import { DEFAULT_CONFIG } from '../../engine/config';
import { realDeps } from '../../store/deps';
import { db } from '../../db/db';

export function MindDetailScreen() {
  const navigate = useNavigate();
  const todayStr = localDate(
    realDeps.now(),
    DEFAULT_CONFIG.arc.timezone,
    DEFAULT_CONFIG.arc.dayBoundaryHour
  );

  const [dsaProblems, setDsaProblems] = useState<number>(0);
  const [deepMinutes, setDeepMinutes] = useState<number>(0);
  const [topicInput, setTopicInput] = useState('');
  const [minutesInput, setMinutesInput] = useState(45);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const attempts = await db.dsa_attempt.toCollection().toArray();
        setDsaProblems(attempts.length);

        const blocks = await db.learning_block.toCollection().toArray();
        const mins = blocks.reduce((acc, b) => acc + (b.minutes || 0), 0);
        setDeepMinutes(mins);
      } catch (err) {
        console.error('Failed to load mind stats:', err);
      }
    })();
  }, [savedSuccess]);

  const handleLogStudySession = async () => {
    if (!topicInput.trim()) return;
    try {
      await db.learning_block.add({
        id: `lb-${Date.now()}`,
        local_date: todayStr,
        topic: topicInput.trim(),
        minutes: minutesInput,
      });
      setSavedSuccess(true);
      setTopicInput('');
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to save study block:', err);
    }
  };

  return (
    <div className="px-gutter pb-12 pt-2">
      {/* Top Back Navigation */}
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          onClick={() => navigate('/progress')}
          className="flex items-center gap-2 text-xs font-mono font-bold text-accent-mid hover:text-accent-bright transition-colors"
        >
          <ArrowLeft size={16} weight="bold" />
          <span>BACK TO PROGRESS</span>
        </button>

        <button
          type="button"
          onClick={() => navigate('/skills')}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded cut-sm border border-purple-500/40 bg-purple-950/30 text-xs font-mono text-purple-200 hover:border-purple-400 transition-all"
        >
          <Sparkle size={14} weight="fill" color="#c084fc" />
          <span>SPELL TREE</span>
        </button>
      </div>

      <ScreenTitle title="MIND ASCENSION" compact className="mb-3" />

      {/* Hero Card */}
      <div
        className="cut-md relative mb-4 overflow-hidden p-4 transition-all duration-200"
        style={{
          border: '1px solid rgba(168, 85, 247, 0.45)',
          background: 'linear-gradient(180deg, rgba(30, 15, 50, 0.9), rgba(10, 5, 20, 0.96))',
          boxShadow: '0 0 24px rgba(168, 85, 247, 0.2)',
        }}
      >
        {/* Mind Art Background */}
        <div
          aria-hidden
          className="pointer-events-none absolute right-0 top-0 h-full w-[200px] overflow-hidden"
          style={{
            mixBlendMode: 'lighten',
            opacity: 0.55,
            maskImage: 'radial-gradient(120% 100% at 100% 30%, #000 40%, transparent 80%)',
            WebkitMaskImage: 'radial-gradient(120% 100% at 100% 30%, #000 40%, transparent 80%)',
          }}
        >
          <ArtLayer slot="skills" scrim="none" focal="60% 30%" />
        </div>

        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-1">
            <Brain size={22} weight="fill" color="#c084fc" className="drop-shadow-[0_0_8px_#c084fc]" />
            <h2 className="font-display text-xl font-bold uppercase tracking-[0.14em] text-purple-100 glow-text">
              MIND · INTELLECT & FOCUS
            </h2>
          </div>
          <p className="text-xs font-mono uppercase tracking-[0.14em] text-purple-300/70 mb-4">
            DISCIPLINE · DEPTH · PROBLEM SOLVING
          </p>

          <div className="grid grid-cols-3 gap-2 pt-3 border-t border-purple-500/20">
            <div>
              <span className="text-[9px] font-mono uppercase tracking-wider text-purple-300/60 block">
                DSA PROBLEMS
              </span>
              <span className="font-mono text-lg font-bold text-purple-200">{dsaProblems}</span>
            </div>
            <div>
              <span className="text-[9px] font-mono uppercase tracking-wider text-purple-300/60 block">
                DEEP FOCUS
              </span>
              <span className="font-mono text-lg font-bold text-amber-400">
                {deepMinutes} <span className="text-xs">mins</span>
              </span>
            </div>
            <div>
              <span className="text-[9px] font-mono uppercase tracking-wider text-purple-300/60 block">
                STREAK POOL
              </span>
              <span className="font-mono text-xs font-bold text-emerald-400 block mt-1">
                ACTIVE FOCUS
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Log Study Block Card */}
      <div
        className="cut-md p-4 mb-4 relative"
        style={{
          border: '1px solid rgba(168, 85, 247, 0.35)',
          background: 'linear-gradient(180deg, rgba(20, 10, 35, 0.9), rgba(8, 4, 16, 0.96))',
        }}
      >
        <div className="flex items-center justify-between mb-3 border-b border-purple-500/20 pb-3">
          <div className="flex items-center gap-2">
            <BookOpen size={18} weight="fill" color="#c084fc" />
            <h3 className="font-display text-base font-bold text-purple-100 uppercase tracking-wider">
              LOG MENTAL DISCIPLINE TRIAL
            </h3>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-[10px] font-mono text-purple-300 uppercase tracking-wider mb-1">
              TOPIC / SPELL / ALGORITHM STUDIED
            </label>
            <input
              type="text"
              value={topicInput}
              onChange={(e) => setTopicInput(e.target.value)}
              placeholder="e.g. Graph Neural Networks, Dynamic Programming, System Design..."
              className="w-full bg-surface-2 border border-purple-500/30 px-3 py-2 rounded cut-sm text-xs font-mono text-ink-100 focus:outline-none focus:border-purple-400"
            />
          </div>

          <div>
            <label className="block text-[10px] font-mono text-purple-300 uppercase tracking-wider mb-1">
              DURATION (MINUTES)
            </label>
            <input
              type="number"
              value={minutesInput}
              onChange={(e) => setMinutesInput(parseInt(e.target.value) || 0)}
              className="w-full bg-surface-2 border border-purple-500/30 px-3 py-2 rounded cut-sm text-xs font-mono text-ink-100 focus:outline-none focus:border-purple-400"
            />
          </div>

          <button
            type="button"
            onClick={handleLogStudySession}
            className="cut-sm w-full py-2.5 flex items-center justify-center gap-2 font-mono text-xs font-bold uppercase tracking-wider text-black bg-purple-400 hover:bg-purple-300 shadow-[0_0_16px_rgba(192,132,252,0.4)] transition-all"
          >
            <CheckCircle size={16} weight="bold" />
            <span>RECORD MENTAL TRIAL</span>
          </button>

          {savedSuccess && (
            <div className="p-2 cut-sm border border-emerald-500/50 bg-emerald-950/40 text-center font-mono text-xs text-emerald-300">
              ✓ STUDY SESSION RECORDED SUCCESSFULLY!
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
