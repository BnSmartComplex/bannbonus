export type PresenceStatus = "ONLINE" | "OFFLINE";

export type DispatchEligibility = {
  technician_id: string;
  presence_status: PresenceStatus;
  presence_is_fresh: boolean;
  has_active_visit: boolean;
  has_active_assignment: boolean;
  has_conflicting_booking: boolean;
  skill_match: boolean;
  area_match: boolean;
  is_available: boolean;
  reasons: readonly string[];
};

// Eligibility must be computed from transactional server-side state, never browser presence alone.
