# ADR-0004 — Real-time callout + 24-hour advance booking
Date: 2026-10-17
Source: Owner instruction, Day Neramit reference website.
- Customer-facing identity: Day Neramit. Internal platform: BannBonus / BNSmart.
- 10:00–02:00 Asia/Bangkok: immediate service requests may be submitted only when an eligible online technician is not blocked. This is **not** a confirmed dispatch; authorized staff atomically assigns and the technician accepts.
- Booking requests may be **submitted 24/7**, with a customer-selected future date/time inside service hours.
- For unavailable dates staff proposes a different slot. Customer explicitly accepts/rejects in My Bookings. Only an authorized operator can confirm an accepted proposed slot after a conflict/capability check.
- Public status is aggregate only; no names, whereabouts, active job details or private schedules.
- If backend is unconfigured or tenant ambiguous, availability reports UNKNOWN, not AVAILABLE.
- Backend remains the source of truth; exact confirmation is transactional. No new AI, payments or LINE activation.
- Migration 0006 requires independent production DB identification and review. Preview must not be mistaken for live booking if production credentials or accounts are missing.
