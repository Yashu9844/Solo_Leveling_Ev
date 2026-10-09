// Build-time flags with a dev-only override (platform/04 §38.1). None of them
// is a user setting: a flag decides which build a person is running, and a
// rollback is "deploy the previous build", not "find the switch".

let engineV2Override: boolean | undefined;

/**
 * ENGINE_V2 (platform/05 Phase 6): run the owner's System on the Blueprint
 * engine instead of the hard-wired one. Off unless the BUILD says otherwise
 * (VITE_ENGINE_V2=true), so no deploy changes the owner's engine by accident.
 * The override exists for tests and local experiments.
 */
export function engineV2Enabled(): boolean {
  if (engineV2Override !== undefined) return engineV2Override;
  return import.meta.env.VITE_ENGINE_V2 === 'true';
}

/** Test/dev only. Pass `undefined` to return to the build's setting. */
export function setEngineV2Override(value: boolean | undefined): void {
  engineV2Override = value;
}
