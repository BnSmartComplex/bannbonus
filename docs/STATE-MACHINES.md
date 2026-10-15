# State Machines — normative draft
## Technician
Manual presence: ONLINE | OFFLINE (technician controlled).
Computed operational: AVAILABLE | OFFERED | ASSIGNED | EN_ROUTE | ON_SITE | WORKING | WRAPPING_UP | UNAVAILABLE.
AVAILABLE iff ONLINE and no active assignment/visit/check-in and no conflicting confirmed booking in relevant time window, required skill and service area match, status data fresh.
Do not automatically mark AVAILABLE merely because a check-out event occurred; re-evaluate all constraints.
## Job
REQUESTED -> TRIAGING -> OFFERED -> ACCEPTED -> EN_ROUTE -> ON_SITE -> IN_PROGRESS -> QC_PENDING -> COMPLETED -> CLOSED.
Alternative: WAITING_BOOKING, CANCELLED, UNFULFILLABLE; exceptions require actor, reason, timestamp and event.
No jump from REQUESTED to EN_ROUTE without confirmed assignment. Check-in creates active visit; check-out closes it. A job may have multiple visits but only one active visit per technician.
## Booking
REQUESTED -> PENDING_TEAM_REVIEW -> CONFIRMED | DECLINED | PROPOSED_NEW_SLOT | CANCELLED | EXPIRED.
Only an authorized team member may transition to CONFIRMED after server rechecks availability and holds/locks slot atomically. Customer selection alone remains REQUESTED. Proposals require customer acceptance before team confirmation if time changed.
## Dispatch offer
CREATED -> SENT -> ACCEPTED | REJECTED | EXPIRED | CANCELLED.
Atomic first valid acceptance wins; reject stale offers, expired offers and techs with new conflicting work.
## Invariants
No active double-assignment; no overlapping confirmed bookings for same technician including travel buffer; no unverified customer promise; no missing actor/reason on override; all transitions audited; all outbound notifications sourced from persisted events.

## Booking intake research sidecar
After a valid booking request is persisted in PENDING_REVIEW, enqueue a separate idempotent device-research workflow: QUEUED -> IDENTIFYING -> RESEARCHING -> VERIFIED | NEEDS_INFO | UNVERIFIED | FAILED. This workflow never changes booking to CONFIRMED. Missing brand/model requires an uploaded equipment photo; uncertain model identification prompts staff/customer for nameplate image when available. Failures must not silently erase booking requests.
