import type { QuestInstance, QuestTemplate } from '../../engine/types';
import { FramedPanel, PrimaryButton, SecondaryButton, Sheet } from '../kit';
import { CRITERION_TEXT } from './criterionText';

interface QuestDetailSheetProps {
  template: QuestTemplate;
  instance: QuestInstance;
  dayClosed: boolean;
  onClose: () => void;
  onToggle: () => void;
  /**
   * The per-domain logging sheet (final/02 §2 for CAREER, final/03 §2
   * for DSA, final/03 §4 for BUILD, final/04 for TRAINING/SLEEP/
   * ATTENTION) — logging real data is what auto-completes these quests;
   * the "Mark complete" button below always stays available as a manual
   * fallback/override. `label` names the action ("Log application",
   * "Log problem", "Log session").
   */
  domainLog?: { label: string; onOpen: () => void };
}

/**
 * The quest's detail surface — final/06 §5.3.
 *
 * Deliberately quote-free. §5.3 says it outright: "No motivational quote
 * here — competence evidence outperforms it at the point of action."
 * This is the screen opened when someone is about to do the thing, and
 * what belongs on it is their own commitment and the exact criterion,
 * not encouragement.
 */
export function QuestDetailSheet({
  template,
  instance,
  dayClosed,
  onClose,
  onToggle,
  domainLog,
}: QuestDetailSheetProps) {
  const complete = instance.state === 'complete';

  return (
    <Sheet
      open
      onClose={onClose}
      title={template.title}
      footer={
        <PrimaryButton size="md" onClick={onToggle} disabled={dayClosed}>
          {complete ? 'Undo' : 'Mark complete'}
        </PrimaryButton>
      }
    >
      {template.implementation_intention && (
        // The user's own sentence, framed and quoted back verbatim. It
        // is the highest-leverage thing in onboarding (final/06 §5.1)
        // and this is the moment it is supposed to pay off.
        <FramedPanel className="mb-5 px-4 py-4">
          <p className="font-display text-[calc(16px*var(--type-scale))] leading-[1.5] text-ink-100">
            &ldquo;At {template.implementation_intention.time} at{' '}
            {template.implementation_intention.place} I will{' '}
            {template.implementation_intention.first_action}.&rdquo;
          </p>
        </FramedPanel>
      )}

      <p className="text-sm leading-[1.55] text-ink-500">{CRITERION_TEXT[template.key]}</p>

      {!complete && domainLog && (
        <div className="mt-5">
          <SecondaryButton onClick={domainLog.onOpen} disabled={dayClosed}>
            {domainLog.label}
          </SecondaryButton>
        </div>
      )}
    </Sheet>
  );
}
