# ADR 0003 — Reconfirm 21:00 night boundary

Date: 2026-10-17. Status: proposed implementation of explicit owner instruction; PR review pending.

PR #5 defined 21:00, while PR #6 changed it to 22:00 based on an earlier instruction. The current owner request explicitly confirms 299 baht during 10:00–20:59 and starting 499 baht during 21:00–01:59. Apply the latest instruction, preserving the rest of PR #6 including PWA assets. GOLD, supporting policy, reference calculation and UI must agree. All times are Asia/Bangkok; 02:00 is closed for new dispatch, advance requests remain free and require human approval.

No schema migration or financial activation. Road route must originate at the assigned contractor's verified base; excess-distance charges remain disabled. Reference calculations are not a persisted or authorized quote. Revert this PR to roll back; do not enable financial workflows on the reverted 22:00 policy without owner review.
