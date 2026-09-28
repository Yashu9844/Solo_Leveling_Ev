import { CaretLeft, Database, Info, PaintBrush, SlidersHorizontal, Cpu, Lightning } from '@phosphor-icons/react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useSettings } from '../../store/SettingsContext';
import { ACCENTS } from '../../store/settings';
import { ScreenTitle, SettingsGroup, SettingsList, SettingsRow } from '../kit';
import { THEME_LABELS, TEXT_SCALE_LABELS } from './labels';

/**
 * The settings index. Each section is a pushed route.
 * Upgraded with a Solo Leveling System Control Center aesthetic.
 */
export function SettingsScreen() {
  const navigate = useNavigate();
  const { settings } = useSettings();

  const summary =
    settings.accent === 'theme'
      ? THEME_LABELS[settings.theme]
      : `${THEME_LABELS[settings.theme]} · ${ACCENTS[settings.accent].label}`;

  return (
    <>
      <div className="px-gutter pb-8 pt-2" data-testid="settings-screen">
        {/* One h1 per screen. This screen rendered the sr-only one from
            ScreenHeader *and* a visible one with the same word, so a
            heading query matched two elements — the same strict-mode
            fault already fixed on the four tabs. The back control is
            kept (design/02 §5: a route you pushed by tapping must be
            leavable by tapping) and its "Back" name is frozen by §10. */}
        <div className="mb-4 flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate('/profile')}
            aria-label="Back"
            className="-ml-2 flex min-h-tap min-w-[44px] shrink-0 items-center justify-center text-ink-500 transition-colors hover:text-accent-mid"
          >
            <CaretLeft size={18} aria-hidden />
          </button>
          <ScreenTitle title="SETTINGS" className="min-w-0 flex-1" />
        </div>

        {/* System Status Dashboard Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="cut-md relative mb-5 overflow-hidden p-4"
          style={{
            border: '1px solid rgba(77, 163, 255, 0.35)',
            background: 'linear-gradient(180deg, rgba(10, 20, 36, 0.92), rgba(5, 10, 20, 0.98))',
            boxShadow: '0 0 24px rgba(77, 163, 255, 0.15)',
          }}
        >
          <div className="flex items-center justify-between mb-3 border-b border-hair-faint pb-2">
            <div className="flex items-center gap-2">
              <Cpu size={18} weight="fill" color="#5fb2ff" className="drop-shadow-[0_0_8px_#5fb2ff]" />
              <span className="text-xs font-bold uppercase tracking-wider text-ink-100">
                SYSTEM OVERRIDE STATUS
              </span>
            </div>
            <span className="text-[9px] font-mono text-accent-mid bg-accent-deep/40 px-2 py-0.5 rounded border border-accent/30 font-bold">
              MONARCH CORE v1.0
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2 rounded bg-surface/60 border border-hair-faint">
              <div className="text-[9px] uppercase font-mono text-ink-700">ACTIVE ENGINE</div>
              <div className="font-mono text-xs font-bold text-accent-mid mt-0.5 flex items-center gap-1">
                <Lightning size={12} weight="fill" color="#5fb2ff" />
                <span>OFFLINE LOCAL DB</span>
              </div>
            </div>
            <div className="p-2 rounded bg-surface/60 border border-hair-faint">
              <div className="text-[9px] uppercase font-mono text-ink-700">THEME MODE</div>
              <div className="font-mono text-xs font-bold text-ink-100 mt-0.5 uppercase truncate">
                {settings.theme}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Navigation Section */}
        <SettingsGroup title="Application Protocols">
          <SettingsList>
            <SettingsRow
              icon={PaintBrush}
              label="Appearance"
              description="Theme, accent, text size, motion intensity"
              value={summary}
              onClick={() => navigate('/profile/settings/appearance')}
              testId="settings-appearance-row"
            />
            <SettingsRow
              icon={SlidersHorizontal}
              label="System Protocol"
              description="Reminders, intentions, daily operating hours"
              onClick={() => navigate('/profile/settings/system')}
              testId="settings-system-row"
            />
            <SettingsRow
              icon={Database}
              label="Data Vault"
              description="IndexedDB backup, paper import, integrity diagnostics"
              onClick={() => navigate('/profile/settings/data')}
              testId="settings-data-row"
            />
            <SettingsRow
              icon={Info}
              label="About System"
              description="Version build, arc timeline, systemic reset"
              onClick={() => navigate('/profile/settings/about')}
              testId="settings-about-row"
            />
          </SettingsList>
        </SettingsGroup>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mt-6 px-1 text-xs leading-[1.5] text-ink-500 font-medium"
        >
          Appearance protocols are bound locally to this device instance. They operate in complete isolation from arc records to ensure zero cross-device layout distortion.
        </motion.p>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mt-4 p-2.5 rounded cut-sm border border-accent/20 bg-accent-deep/10 font-mono text-xxs tabular-nums text-accent-mid/80 flex items-center justify-between"
        >
          <span>TEXT SCALE: {TEXT_SCALE_LABELS[settings.textScale]}</span>
          <span>DENSITY: {settings.density.toUpperCase()}</span>
          <span>MOTION: {settings.motion.toUpperCase()}</span>
        </motion.div>
      </div>
    </>
  );
}

