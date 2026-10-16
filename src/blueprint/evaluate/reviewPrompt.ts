// The evening review's one domain prompt (platform/02 §17.1). Chips only, chosen deterministically from the System's own prompts: a domain
// that missed today first, then the week's bottleneck, then whichever has gone longest without being asked. Pure.
import type { SystemBlueprint } from '../schema';

export interface ReviewPromptFacts {
  /** Domains with a core quest not completed today. */
  missedToday: ReadonlySet<string>;
  /** Core quests missed per domain over the last seven days (days the arc was running). */
  misses7: ReadonlyMap<string, number>;
  /** The prompt ids asked on earlier reviews, most recent first. */
  recentPromptIds: readonly string[];
}

export type ReviewPromptReason = 'missed' | 'bottleneck' | 'rotation';

export interface ChosenPrompt {
  id: string;
  domainId: string;
  prompt: string;
  options: string[];
  reason: ReviewPromptReason;
}

export function chooseDomainPrompt(blueprint: SystemBlueprint, facts: ReviewPromptFacts): ChosenPrompt | null {
  const priority = new Map(blueprint.domains.map((domain) => [domain.id, domain.priority]));
  const prompts = blueprint.reviews.domainPrompts.filter((prompt) => priority.has(prompt.domainId) && prompt.options.length > 0);
  if (prompts.length === 0) return null;

  const missed = prompts.filter((prompt) => facts.missedToday.has(prompt.domainId));
  const worst = Math.max(0, ...prompts.map((prompt) => facts.misses7.get(prompt.domainId) ?? 0));
  const bottleneck = worst > 0 ? prompts.filter((prompt) => (facts.misses7.get(prompt.domainId) ?? 0) === worst) : [];
  const [pool, reason]: [typeof prompts, ReviewPromptReason] = missed.length > 0 ? [missed, 'missed'] : bottleneck.length > 0 ? [bottleneck, 'bottleneck'] : [prompts, 'rotation'];

  // Within a pool: the prompt asked longest ago (never asked first), then the heavier week, then the domain the person ranked higher.
  const askedAgo = (id: string): number => { const index = facts.recentPromptIds.indexOf(id); return index < 0 ? Number.POSITIVE_INFINITY : index; };
  const chosen = [...pool].sort((a, b) =>
    askedAgo(b.id) - askedAgo(a.id) || (facts.misses7.get(b.domainId) ?? 0) - (facts.misses7.get(a.domainId) ?? 0) || priority.get(a.domainId)! - priority.get(b.domainId)! || a.id.localeCompare(b.id),
  )[0]!;
  return { id: chosen.id, domainId: chosen.domainId, prompt: chosen.prompt, options: chosen.options, reason };
}

/** Whether an answer is one of the prompt's own chips: the writer refuses anything else. */
export function isPromptAnswer(blueprint: SystemBlueprint, promptId: string, answer: string): boolean {
  return blueprint.reviews.domainPrompts.some((prompt) => prompt.id === promptId && prompt.options.includes(answer));
}
