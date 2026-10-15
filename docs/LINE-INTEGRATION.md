# LINE OA + Group Bot Integration
User confirms an existing LINE OA and team group; no credentials or groupId have been supplied. Integration is NOT LIVE.
1. Configure LINE Messaging API channel, channel access token and signing secret in secret manager.
2. Add OA bot to team group where supported and authorized; capture groupId from verified webhook event; confirm push permissions and quotas.
3. Expose HTTPS webhook endpoint, verify X-Line-Signature on raw body, dedupe webhookEventId, log correlation ID.
4. Intake -> persisted job -> transactional outbox -> LINE team notification with job number, service category, rough area, status and authenticated deep link. Avoid customer name/phone/address in group.
5. Booking request -> PENDING_TEAM_REVIEW notification; team approves in admin app; only then send CONFIRMED message to customer and team.
6. Dispatch offer notification is NOT assignment; after atomic accept send confirmed technician notice.
7. Retries with exponential backoff, dead-letter/admin inbox, provider response logging, monitoring. Never imply push delivered merely because event queued.
8. No LINE Notify. Customer communication through consented OA relationship or suitable alternative channel, respecting platform rules.
Test webhook forgery, duplicate deliveries, blocked bot, invalid tokens, group removal, customer unfollow, rate limits and PII redaction.
