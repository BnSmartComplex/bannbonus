# API Contracts — proposed v1
All authenticated calls tenant-scoped, with request_id/idempotency_key and structured error codes; actual implementation not yet present.
POST /api/v1/intake: create service request; returns request_id, status REQUESTED; no technician promise.
GET /api/v1/technicians/status: role-scoped status and active_job_id; redact customer PII.
POST /api/v1/technicians/me/presence: ONLINE/OFFLINE; authenticated technician.
POST /api/v1/jobs/{id}/offers: operator/backend only; validates eligible candidates.
POST /api/v1/offers/{id}/accept: technician; transactional assignment; 409 CONFLICT if already taken/blocked.
POST /api/v1/jobs/{id}/en-route: assigned technician.
POST /api/v1/jobs/{id}/check-in: assigned technician; creates active visit.
POST /api/v1/jobs/{id}/check-out: assigned technician; closes visit after required records.
GET /api/v1/booking/slots?service_id=&area=&date=: estimates only, status PROVISIONAL; never a guarantee.
POST /api/v1/bookings: customer requests slot -> PENDING_TEAM_REVIEW.
POST /api/v1/bookings/{id}/confirm: operator only; transactional conflict recheck -> CONFIRMED or 409.
POST /api/v1/bookings/{id}/decline: operator only with reason.
POST /api/v1/line/webhook: validate signature, dedupe event ID, enqueue domain commands.
GET /api/v1/admin/outbox: operator sees failed/pending LINE notifications.
## Standard errors
400 VALIDATION_ERROR; 401 UNAUTHENTICATED; 403 FORBIDDEN; 404 NOT_FOUND; 409 CONFLICT/STALE_STATE; 422 INELIGIBLE_TECHNICIAN; 429 RATE_LIMIT; 503 EXTERNAL_INTEGRATION_UNAVAILABLE.
## Security
No public customer PII in group notifications. Audit write actor, tenant, entity version, timestamp, correlation ID. Never trust client-provided availability or role.
