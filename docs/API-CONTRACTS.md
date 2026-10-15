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

## Proposed equipment intake extension
Booking request payload must include equipment_category (including OTHER), fault_description, and either (brand AND model_number) OR equipment_photo_upload_id(s). Reject incomplete input with field-specific 400 errors. Treat photo IDs as authenticated, tenant-scoped, validated uploads; inspect content type/size and prevent unauthorized access. After persisted booking request, enqueue research via outbox/idempotent worker. Expose separate staff-facing device research status, source references and unknown-model flag. Research cannot confirm a booking.

## Device identification and precomputed dossier contract (proposed)
POST /api/v1/bookings/:id/device-identification-response accepts response=CONFIRMED|UNSURE|UNKNOWN|REJECTED, candidate_model_id nullable and optional correction. GET /api/v1/bookings/:id/device-candidates shows provenance and unverified status. GET /api/v1/technician/jobs/:id/device-dossier returns last persisted snapshot with generated_at, freshness, research_status, evidence links, model applicability, specs, components/functions/verified quantities, common failures, ranked hypotheses and unknowns. Must be tenant-scoped and job-authorized. Do not perform blocking external research in the GET handler. Research begins asynchronously at booking creation, even without customer confirmation; invalid/unknown model never becomes verified automatically.

## Dossier role-scoped API responses
GET /api/v1/customer/bookings/:id/device-overview returns customer-safe projection only: public specifications, high-level components/functions, and non-diagnostic common symptoms, with verified-source markers and no root-cause hypotheses or actionable troubleshooting/repair details. GET /api/v1/technician/jobs/:id/device-dossier returns complete evidence-backed dossier only for assigned/authorized technician or operator. Server enforces tenant/job ownership and role-based field-level serialization; do not fetch full dossier to browser then hide fields. Separate caching, downloads, logs and LINE templates by audience, with automated authorization and leak tests.

## Device image comparison extension
GET /api/v1/customer/bookings/:id/device-candidates includes reference_image_url nullable, image_source_url, license/usage_status, exact_model_image boolean, model_match_status, and customer_uploaded_image_urls scoped to booking owner. POST /api/v1/bookings/:id/device-identification-response retains customer CONFIRMED/UNSURE/UNKNOWN/REJECTED and optional correction. Serve customer photos only via authorized signed URLs; enforce content moderation/file validation, EXIF handling, source licensing, and no internal diagnosis leakage.
