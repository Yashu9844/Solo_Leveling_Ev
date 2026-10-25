// Build-time flags with a dev-only override (platform/04 §38.1). None of them
// is a user setting: a flag decides which build a person is running, and a
// rollback is "deploy the previous build", not "find the switch".

let engineV2Override: boolean | undefined;

/**
 * ENGINE_V2 (platform/05 Phase 6): run the System on the Blueprint engine
 * instead of the hard-wired one. On unless the BUILD says otherwise: the
 * public link is for everyone, so it ships the engine that can play any
 * System. A build for the owner's original System alone sets
 * VITE_ENGINE_V2=false. The override exists for tests and local experiments.
 */
export function engineV2Enabled(): boolean {
  if (engineV2Override !== undefined) return engineV2Override;
  return import.meta.env.VITE_ENGINE_V2 !== 'false';
}

/** Test/dev only. Pass `undefined` to return to the build's setting. */
export function setEngineV2Override(value: boolean | undefined): void {
  engineV2Override = value;
}

let newOnboardingOverride: boolean | undefined;

/**
 * NEW_ONBOARDING (platform/05 Phase 10): a person with no arc is interviewed and given a generated System instead of the owner's
 * fixed six steps. It governs new arcs only - an arc that exists is never touched - and it needs ENGINE_V2, because a generated
 * System runs on the Blueprint engine and the hard-wired one cannot play it. On by default with ENGINE_V2; VITE_NEW_ONBOARDING=false
 * turns it off.
 */
export function newOnboardingEnabled(): boolean {
  if (!engineV2Enabled()) return false;
  if (newOnboardingOverride !== undefined) return newOnboardingOverride;
  return import.meta.env.VITE_NEW_ONBOARDING !== 'false';
}

/** Test/dev only. Pass `undefined` to return to the build's setting. */
export function setNewOnboardingOverride(value: boolean | undefined): void {
  newOnboardingOverride = value;
}
