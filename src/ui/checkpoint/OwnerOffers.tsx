import { useEffect, useState } from 'react';
import { addDays, format, parseISO } from 'date-fns';
import { applicableOffers, type OwnerOffer } from '../../blueprint/ownerOffers';
import type { SystemBlueprint } from '../../blueprint/schema';
import { realDeps } from '../../store/deps';
import { getActiveProfile } from '../../store/arc';
import { activateBlueprint } from '../../store/blueprint';
import { declineOffer, isDeclined } from '../../store/ownerOffers';
import { useBlueprintVersions } from '../../store/systemBlueprint';
import { Panel, PrimaryButton, SecondaryButton } from '../kit';

type Answer = 'accepted' | 'declined';

/**
 * The owner's opt-in offers (platform/02 §22.4), put at a sealed checkpoint's Amend step: things the System has always done short of what it
 * was designed to. Each is accepted or declined on its own; accepting writes an ordinary structural version that begins tomorrow, declining
 * changes nothing.
 */
export function OwnerOffers({ checkpointDay, today }: { checkpointDay: number; today: string }) {
  const versions = useBlueprintVersions();
  const latest: SystemBlueprint = versions[versions.length - 1]!;
  const [wakeTime, setWakeTime] = useState<string | undefined>(undefined);
  const [wakeTimeKnown, setWakeTimeKnown] = useState(false);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void getActiveProfile().then((profile) => {
      const wake = (profile?.settings as { wakeTime?: unknown } | undefined)?.wakeTime;
      if (cancelled) return;
      setWakeTime(typeof wake === 'string' ? wake : undefined);
      setWakeTimeKnown(true);
    });
    return () => { cancelled = true; };
  }, []);

  // The offers are decided once, when the step opens: answering one must not make another (or the answered one) vanish.
  const [offers, setOffers] = useState<ReturnType<typeof applicableOffers> | null>(null);
  useEffect(() => {
    if (offers === null && wakeTimeKnown) setOffers(applicableOffers(latest, { wakeTime }).filter(({ offer }) => !isDeclined(offer.id, checkpointDay)));
  }, [offers, wakeTimeKnown, latest, wakeTime, checkpointDay]);
  if (!offers || offers.length === 0) return null;

  async function accept(offer: OwnerOffer, candidate: SystemBlueprint): Promise<void> {
    if (busy) return;
    setBusy(true);
    setFailure(null);
    try {
      candidate.changeClass = 'structural';
      candidate.activeFrom = format(addDays(parseISO(today), 1), 'yyyy-MM-dd');
      await activateBlueprint(candidate, today, realDeps);
      setAnswers((previous) => ({ ...previous, [offer.id]: 'accepted' }));
    } catch (error) {
      setFailure(error instanceof Error ? error.message : 'The System refused this change.');
    } finally {
      setBusy(false);
    }
  }
  function decline(offer: OwnerOffer): void {
    declineOffer(offer.id, checkpointDay);
    setAnswers((previous) => ({ ...previous, [offer.id]: 'declined' }));
  }

  return (
    <div className="mt-4 flex flex-col gap-3" data-testid="owner-offers">
      {offers.map(({ offer, candidate }) => (
        <Panel key={offer.id} cut="sm" bodyClassName="px-4 py-4">
          <div data-testid={`owner-offer-${offer.id}`}>
            <p className="text-sm font-semibold text-ink-100">{offer.title}</p>
            <p className="mt-1 text-xs leading-[1.5] text-ink-500">{offer.description}</p>
            {answers[offer.id] ? (
              <p className="glow-text mt-3 text-xs text-accent-mid" data-testid={`owner-offer-${offer.id}-answer`}>{answers[offer.id] === 'accepted' ? 'Accepted. It begins tomorrow.' : 'Declined. Nothing changed.'}</p>
            ) : (
              <div className="mt-3 flex flex-col gap-2">
                <PrimaryButton size="md" disabled={busy} onClick={() => void accept(offer, candidate)} data-testid={`owner-offer-${offer.id}-accept`}>Accept</PrimaryButton>
                <SecondaryButton onClick={() => decline(offer)} data-testid={`owner-offer-${offer.id}-decline`}>Decline</SecondaryButton>
              </div>
            )}
          </div>
        </Panel>
      ))}
      {failure && <p className="text-xs text-ink-100" role="alert">{failure}</p>}
    </div>
  );
}
