export type DispatchEligibility = { eligible: boolean; reasons: readonly string[] };
// Eligibility must be computed from transactional server-side state, never browser presence alone.
