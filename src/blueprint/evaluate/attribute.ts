// The attribute DSL (platform/02 §11): each attribute is a set of terms, each
// term a signal pushed through a transform and clamped to [0,1]. A `sum`
// attribute weights its terms; a `product` attribute multiplies its factors
// and reports one component. For LEGACY_BLUEPRINT_V1 this reproduces
// engine/attributes.ts's attributesFrom (and store/attributes.ts's inputs)
// to the last float.
import type { AttributeDef, SystemBlueprint } from '../schema';
import { resolveSignal, type SignalEnv } from './signals';

export interface AttributeValue {
  attribute: string;
  /** 0–100. */
  value: number;
  /** Each term's contribution to value/100; they sum to it. */
  components: Record<string, number>;
}

function clamp01(x: number): number {
  if (Number.isNaN(x)) return 0;
  return Math.max(0, Math.min(1, x));
}

function transformed(term: AttributeDef['terms'][number], raw: number): number {
  switch (term.transform.kind) {
    case 'ratio': return raw / term.transform.denominator;
    case 'inverse_ratio': return 1 - clamp01(raw / term.transform.denominator);
    case 'rate': return raw;
  }
}

export function evaluateAttribute(definition: AttributeDef, env: SignalEnv): AttributeValue {
  const unit = definition.terms.map((term) => ({ term, value: clamp01(transformed(term, resolveSignal(term.signal, env))) }));
  let components: Record<string, number>;
  if (definition.combine === 'product') {
    components = { [definition.productKey ?? 'product']: unit.reduce((product, { value }) => product * value, 1) };
  } else {
    components = {};
    for (const { term, value } of unit) components[term.id] = term.weight * value;
  }
  return { attribute: definition.id, value: Object.values(components).reduce((sum, part) => sum + part, 0) * 100, components };
}

/** All of a System's attributes, in definition order. */
export function evaluateAttributes(blueprint: SystemBlueprint, env: SignalEnv): AttributeValue[] {
  return blueprint.attributes.defs.map((definition) => evaluateAttribute(definition, env));
}
