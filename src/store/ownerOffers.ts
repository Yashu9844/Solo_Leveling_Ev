// The owner's answers to the opt-in offers (platform/02 §22.4). Declining writes nothing to the System: it is only remembered, per checkpoint,
// so the same offer is not put again in the same Amend step. It is offered afresh at the next checkpoint.
const KEY = 'owner_offers_declined';

function read(): string[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === 'string') : [];
  } catch {
    return [];
  }
}

const keyFor = (offerId: string, checkpointDay: number): string => `${offerId}@${checkpointDay}`;

export function isDeclined(offerId: string, checkpointDay: number): boolean {
  return read().includes(keyFor(offerId, checkpointDay));
}

export function declineOffer(offerId: string, checkpointDay: number): void {
  try {
    localStorage.setItem(KEY, JSON.stringify([...new Set([...read(), keyFor(offerId, checkpointDay)])]));
  } catch {
    // Not remembered: the offer may be put again, which costs nothing.
  }
}
