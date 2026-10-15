import { useState } from 'react';
import { ArrowRight, Quotes } from '@phosphor-icons/react';
import type { ArtSlot } from '../../assets/art';
import { DeepWorkTimer } from '../components/DeepWorkTimer';
import { SingleChipSelect } from '../components/SingleChipSelect';
import { Stepper } from '../components/Stepper';
import { ArtLayer, Field, Sheet, TextInput } from '../kit';
import { MasteryMoment } from '../moments/MasteryMoment';
import { FALLBACK_TOPIC_ICON, LEGACY_STUDY_COPY } from './legacy/studyCopy';
import { recordStudy, type StudyResult } from './recorders/studyBlock';
import { humanize, type InstrumentSheetProps } from './types';

/**
 * The study-block sheet (extracted from the FOUNDATIONAL TRIAL sheet, platform/03
 * §27.2): a topic, the minutes, a note - and, for the one topic that asks for it
 * (`designTopic`), the structured study a sibling instrument records: the system,
 * how it was studied and an optional link. A mastery advance plays the MASTERY Moment.
 *
 * A redesigned sheet matching the sci-fi HUD of the reference; the owner's
 * taglines and banner come from legacy/studyCopy, a generic System gets the form.
 */
export function StudyBlockSheet({ instrument, domain, siblings, today, arcId, onClose }: InstrumentSheetProps) {
  const topics = instrument.params.topics as string[];
  const blockXp = instrument.params.blockXp as number | undefined;
  const designTopic = instrument.params.designTopic as string | undefined;
  const designInstrument = siblings.find((sibling) => sibling.type === 'study_block' && Array.isArray(sibling.params.modes));
  const designModes = ((designInstrument?.params.modes as string[] | undefined) ?? []);
  const copy = LEGACY_STUDY_COPY[instrument.id];
  const title = instrument.logVerb || `Log ${instrument.label}`;
  const artSlot = domain.presentation.artSlot as ArtSlot | undefined;
  const modeLabel = (mode: string) => copy?.designModeLabels[mode] ?? humanize(mode);

  const [topic, setTopic] = useState<string | null>(null);
  const [minutes, setMinutes] = useState(15);
  const [note, setNote] = useState('');
  const [system, setSystem] = useState('');
  const [mode, setMode] = useState<string | null>(null);
  const [artifactUrl, setArtifactUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [masteryMoment, setMasteryMoment] = useState<StudyResult['masteryAdvance'] | null>(null);

  const isDesign = designTopic !== undefined && designInstrument !== undefined && topic === designTopic;
  const canLog = topic !== null && (!isDesign || (system.trim().length > 0 && mode !== null));

  async function handleLog() {
    if (!canLog || submitting || !topic) return;
    setSubmitting(true);
    try {
      const result = await recordStudy(
        instrument,
        designInstrument,
        { topic, minutes, note: note.trim() || undefined, design: isDesign ? { system: system.trim(), mode: mode!, artifactUrl: artifactUrl.trim() || undefined } : undefined },
        { today, arcId }
      );
      if (result.masteryAdvance) {
        setMasteryMoment(result.masteryAdvance);
      } else {
        onClose();
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Sheet
        open
        onClose={onClose}
        title={title}
        hideHeader
        footer={
          <div className="flex flex-col gap-3">
            <button
              type="button"
              disabled={!canLog || submitting}
              onClick={() => void handleLog()}
              className="cut-sm flex min-h-[50px] w-full items-center justify-between px-5 text-sm font-bold uppercase tracking-[0.2em] transition-all duration-200 disabled:opacity-40"
              style={{
                border: '1px solid rgba(192, 132, 252, 0.8)',
                background: 'linear-gradient(180deg, rgba(88, 28, 135, 0.9), rgba(45, 10, 80, 0.98))',
                color: '#ffffff',
                boxShadow: '0 0 20px rgba(168, 85, 247, 0.45)',
              }}
            >
              <span className="flex-1 text-center pl-4">
                {submitting ? 'LOGGING…' : `LOG BLOCK${blockXp !== undefined ? ` · +${blockXp} XP` : ''}`}
              </span>
              <ArrowRight size={18} weight="bold" color="#ffffff" />
            </button>
            {copy && <div className="text-center text-[9px] uppercase tracking-[0.24em] text-ink-700">{copy.footnote}</div>}
          </div>
        }
      >
        {/* Header Hero Bar */}
        <div className="relative -mx-gutter -mt-4 mb-4 px-gutter pt-4 pb-2 overflow-hidden">
          {artSlot && (
            <div
              aria-hidden
              className="pointer-events-none absolute right-0 top-0 h-[190px] w-[220px] overflow-hidden"
              style={{
                mixBlendMode: 'lighten',
                opacity: 0.65,
                maskImage: 'radial-gradient(125% 105% at 100% 0%, #000 40%, transparent 80%)',
                WebkitMaskImage: 'radial-gradient(125% 105% at 100% 0%, #000 40%, transparent 80%)',
              }}
            >
              <ArtLayer slot={artSlot} scrim="none" focal="50% 30%" />
            </div>
          )}

          <div className="relative">
            <div className="flex items-center justify-between text-[9px] uppercase tracking-[0.22em] text-ink-700 mb-2">
              <div>
                <span>SYSTEM</span>
                <div className="h-[1px] w-6 bg-accent-mid/60 mt-0.5" />
              </div>
              <div className="flex items-center gap-3">
                {blockXp !== undefined && <span className="font-mono text-[10px] text-accent-mid font-semibold">+{blockXp} XP</span>}
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close"
                  className="flex h-8 w-8 items-center justify-center rounded-pill text-ink-700 hover:text-accent-bright transition-colors"
                >
                  ✕
                </button>
              </div>
            </div>

            <div>
              <h1 className="font-display text-3xl leading-none tracking-[0.14em] text-ink-100">{title.toUpperCase()}</h1>
              <div className="font-bold text-xs uppercase tracking-[0.22em] text-accent-mid mt-1">{copy?.eyebrow ?? instrument.label.toUpperCase()}</div>
              {copy && <p className="text-[11px] italic text-ink-500 mt-1">{copy.tagline}</p>}
            </div>
          </div>
        </div>

        {/* Quote Banner Box */}
        {copy && (
          <div
            className="cut-sm relative mb-4 p-3 flex items-center justify-between gap-3 overflow-hidden"
            style={{
              border: '1px solid rgba(77, 163, 255, 0.35)',
              background: 'linear-gradient(180deg, rgba(10, 20, 36, 0.85), rgba(5, 10, 20, 0.9))',
              boxShadow: '0 0 14px rgba(77, 163, 255, 0.12)',
            }}
          >
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-pill bg-accent-deep/40 text-accent-mid border border-accent/40 shadow-[0_0_10px_rgba(77,163,255,0.4)]">
                <Quotes size={18} weight="fill" color="#5fb2ff" />
              </div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-ink-100 leading-snug">{copy.banner.line}</p>
            </div>
            <div className="border-l border-hair-faint pl-2 text-right shrink-0">
              <span className="block text-[8px] uppercase tracking-[0.16em] text-ink-700 font-medium max-w-[70px] leading-tight">{copy.banner.aside}</span>
            </div>
          </div>
        )}

        {/* Form Inputs */}
        <div className="flex flex-col gap-4">
          <SingleChipSelect
            label="SELECT TOPIC"
            options={topics}
            labelFor={(t) => t}
            selected={topic}
            onSelect={setTopic}
            iconFor={(t) => copy?.topicIcons[t] ?? FALLBACK_TOPIC_ICON}
          />

          {isDesign && (
            <div
              className="cut-sm p-3.5 flex flex-col gap-3"
              style={{
                border: '1px solid rgba(192, 132, 252, 0.4)',
                background: 'linear-gradient(180deg, rgba(35, 18, 55, 0.75), rgba(18, 10, 32, 0.85))',
              }}
            >
              <Field label="System Name">
                <TextInput type="text" value={system} onChange={(e) => setSystem(e.target.value)} placeholder="e.g. URL shortener, Rate Limiter" />
              </Field>
              <SingleChipSelect label="Study Mode" options={designModes} labelFor={modeLabel} selected={mode} onSelect={setMode} />
              <Field label="Artifact URL (optional)">
                <TextInput type="text" value={artifactUrl} onChange={(e) => setArtifactUrl(e.target.value)} placeholder="https://..." />
              </Field>
            </div>
          )}

          <div
            className="cut-sm p-3.5 flex flex-col gap-3"
            style={{
              border: '1px solid rgba(77, 163, 255, 0.25)',
              background: 'linear-gradient(180deg, rgba(10, 20, 36, 0.8), rgba(5, 10, 20, 0.9))',
            }}
          >
            <Stepper label="Minutes" value={minutes} step={5} min={5} suffix="min" onChange={setMinutes} />
            <DeepWorkTimer onStop={setMinutes} />
          </div>

          <Field label="Note (optional)">
            <TextInput type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="What was key from this session?" />
          </Field>
        </div>
      </Sheet>

      {masteryMoment && <MasteryMoment topic={masteryMoment.topic} state={masteryMoment.state} onDismiss={onClose} />}
    </>
  );
}
