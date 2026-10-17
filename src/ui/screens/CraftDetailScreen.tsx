import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Cpu,
  ArrowLeft,
  Hammer,
  CheckCircle,
} from '@phosphor-icons/react';
import { ArtLayer, ScreenTitle } from '../kit';
import { localDate } from '../../engine/time';
import { getEngineConfig } from '../../store/engineConfig';
import { realDeps } from '../../store/deps';
import { db } from '../../db/db';

export function CraftDetailScreen() {
  const navigate = useNavigate();
  const todayStr = localDate(
    realDeps.now(),
    getEngineConfig().arc.timezone,
    getEngineConfig().arc.dayBoundaryHour
  );

  const [buildSessionsCount, setBuildSessionsCount] = useState<number>(0);
  const [totalBuildMins, setTotalBuildMins] = useState<number>(0);
  const [projectKey, setProjectKey] = useState('');
  const [modeInput, setModeInput] = useState<'LEARN' | 'SHIP'>('SHIP');
  const [minutesInput, setMinutesInput] = useState(60);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const sessions = await db.build_session.toCollection().toArray();
        setBuildSessionsCount(sessions.length);
        const mins = sessions.reduce((acc, s) => acc + (s.minutes || 0), 0);
        setTotalBuildMins(mins);
      } catch (err) {
        console.error('Failed to load build sessions:', err);
      }
    })();
  }, [savedSuccess]);

  const handleLogBuildSession = async () => {
    if (!projectKey.trim()) return;
    try {
      await db.build_session.add({
        id: `build-${Date.now()}`,
        local_date: todayStr,
        mode: modeInput,
        minutes: minutesInput,
        project_key: projectKey.trim(),
      });
      setSavedSuccess(true);
      setProjectKey('');
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to save build session:', err);
    }
  };

  return (
    <div className="px-gutter pb-12 pt-2">
      {/* Top Navigation */}
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          onClick={() => navigate('/progress')}
          className="flex items-center gap-2 text-xs font-mono font-bold text-accent-mid hover:text-accent-bright transition-colors"
        >
          <ArrowLeft size={16} weight="bold" />
          <span>BACK TO PROGRESS</span>
        </button>

        <span className="text-[10px] font-mono text-ink-500 uppercase tracking-wider">
          CRAFT ENGINE
        </span>
      </div>

      <ScreenTitle title="CRAFT ASCENSION" compact className="mb-3" />

      {/* Hero Card */}
      <div
        className="cut-md relative mb-4 overflow-hidden p-4 transition-all duration-200"
        style={{
          border: '1px solid rgba(77, 163, 255, 0.45)',
          background: 'linear-gradient(180deg, rgba(12, 24, 44, 0.9), rgba(5, 10, 20, 0.96))',
          boxShadow: '0 0 24px rgba(77, 163, 255, 0.2)',
        }}
      >
        {/* Boss/Craft Hero Artwork */}
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
          <ArtLayer slot="boss" scrim="none" focal="60% 30%" />
        </div>

        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-1">
            <Cpu size={22} weight="fill" color="#5fb2ff" className="drop-shadow-[0_0_8px_#5fb2ff]" />
            <h2 className="font-display text-xl font-bold uppercase tracking-[0.14em] text-ink-100 glow-text">
              CRAFT · ENGINEERING MASTERY
            </h2>
          </div>
          <p className="text-xs font-mono uppercase tracking-[0.14em] text-ink-500 mb-4">
            ENGINEERING · MOMENTUM · PROJECTS
          </p>

          <div className="grid grid-cols-3 gap-2 pt-3 border-t border-hair-faint">
            <div>
              <span className="text-[9px] font-mono uppercase tracking-wider text-ink-700 block">
                BUILD SESSIONS
              </span>
              <span className="font-mono text-lg font-bold text-ink-100">{buildSessionsCount}</span>
            </div>
            <div>
              <span className="text-[9px] font-mono uppercase tracking-wider text-ink-700 block">
                TOTAL HOURS
              </span>
              <span className="font-mono text-lg font-bold text-amber-400">
                {(totalBuildMins / 60).toFixed(1)} <span className="text-xs">hrs</span>
              </span>
            </div>
            <div>
              <span className="text-[9px] font-mono uppercase tracking-wider text-ink-700 block">
                SHIPPING RATE
              </span>
              <span className="font-mono text-xs font-bold text-emerald-400 block mt-1">
                HIGH MOMENTUM
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Log Build Session Card */}
      <div
        className="cut-md p-4 mb-4 relative"
        style={{
          border: '1px solid rgba(77, 163, 255, 0.35)',
          background: 'linear-gradient(180deg, rgba(10, 20, 36, 0.9), rgba(5, 10, 20, 0.96))',
        }}
      >
        <div className="flex items-center justify-between mb-3 border-b border-hair-faint pb-3">
          <div className="flex items-center gap-2">
            <Hammer size={18} weight="fill" color="#5fb2ff" />
            <h3 className="font-display text-base font-bold text-ink-100 uppercase tracking-wider">
              LOG FORGE CONSTRUCT SESSION
            </h3>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-[10px] font-mono text-ink-500 uppercase tracking-wider mb-1">
              PROJECT KEY / REPO NAME
            </label>
            <input
              type="text"
              value={projectKey}
              onChange={(e) => setProjectKey(e.target.value)}
              placeholder="e.g. NeuralEngine, DistributedKV..."
              className="w-full bg-surface-2 border border-hair-faint px-3 py-2 rounded cut-sm text-xs font-mono text-ink-100 focus:outline-none focus:border-accent"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-mono text-ink-500 uppercase tracking-wider mb-1">
                MODE
              </label>
              <select
                value={modeInput}
                onChange={(e) => setModeInput(e.target.value as 'LEARN' | 'SHIP')}
                className="w-full bg-surface-2 border border-hair-faint px-3 py-2 rounded cut-sm text-xs font-mono text-ink-100 focus:outline-none focus:border-accent"
              >
                <option value="SHIP">SHIP (Feature/Project Code)</option>
                <option value="LEARN">LEARN (System Design & Study)</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-mono text-ink-500 uppercase tracking-wider mb-1">
                DURATION (MINUTES)
              </label>
              <input
                type="number"
                value={minutesInput}
                onChange={(e) => setMinutesInput(parseInt(e.target.value) || 0)}
                className="w-full bg-surface-2 border border-hair-faint px-3 py-2 rounded cut-sm text-xs font-mono text-ink-100 focus:outline-none focus:border-accent"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={handleLogBuildSession}
            className="cut-sm w-full py-2.5 flex items-center justify-center gap-2 font-mono text-xs font-bold uppercase tracking-wider text-black bg-accent-bright hover:bg-white shadow-[0_0_16px_rgba(77,163,255,0.4)] transition-all"
          >
            <CheckCircle size={16} weight="bold" />
            <span>RECORD FORGE SESSION</span>
          </button>

          {savedSuccess && (
            <div className="p-2 cut-sm border border-emerald-500/50 bg-emerald-950/40 text-center font-mono text-xs text-emerald-300">
              ✓ FORGE CONSTRUCT SESSION RECORDED SUCCESSFULLY!
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
