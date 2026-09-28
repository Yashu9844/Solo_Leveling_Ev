import { Briefcase, Sparkle } from '@phosphor-icons/react';
import { motion } from 'framer-motion';
import { IconTile, MeterBar, SectionLabel } from '../kit';

/**
 * The live preview, pinned at the top of Appearance screen.
 * Upgraded with a Holographic System Preview aesthetic.
 */
export function AppearancePreview() {
  return (
    <div
      className="sticky top-0 z-10 -mx-gutter px-gutter pb-4 pt-3"
      style={{ background: 'var(--void)', borderBottom: '1px solid var(--hair-faint)' }}
      aria-hidden
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="cut-sm relative overflow-hidden px-4 py-4 transition-all duration-200"
        style={{
          border: '1px solid rgba(77, 163, 255, 0.4)',
          background: 'linear-gradient(180deg, rgba(12, 22, 38, 0.92), rgba(6, 11, 20, 0.98))',
          boxShadow: '0 0 20px rgba(77, 163, 255, 0.2)',
        }}
      >
        <div className="flex items-center justify-between mb-2">
          <SectionLabel rule className="!mb-0 text-accent-mid font-mono tracking-widest text-[9px] uppercase">
            LIVE SYSTEM PREVIEW HUD
          </SectionLabel>
          <Sparkle size={14} weight="fill" color="#5fb2ff" className="animate-pulse drop-shadow-[0_0_8px_#5fb2ff]" />
        </div>

        <div className="flex items-center gap-3">
          <IconTile icon={Briefcase} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-md font-bold text-ink-100 glow-text">CAREER MANDATE</span>
            <span className="block truncate text-xs text-ink-500">3 applications submitted</span>
          </span>
          <span className="shrink-0 font-mono text-xs font-bold tabular-nums text-accent-mid glow-text">+100 EXP</span>
          <motion.span
            animate={{ scale: [1, 1.12, 1] }}
            transition={{ repeat: Infinity, duration: 2 }}
            className="h-5 w-5 shrink-0 rounded-pill shadow-[0_0_12px_#5fb2ff]"
            style={{ background: 'var(--accent)', boxShadow: 'var(--glow-sm)' }}
          />
        </div>

        <MeterBar pct={68} height={8} className="mt-3" />

        <p className="mt-3 font-display text-[calc(14px*var(--type-scale))] italic leading-[1.4] text-ink-300 [@media(max-height:640px)]:hidden">
          &ldquo;THE SYSTEM DOES NOT WAIT FOR THE HESITANT.&rdquo;
        </p>
      </motion.div>
    </div>
  );
}

