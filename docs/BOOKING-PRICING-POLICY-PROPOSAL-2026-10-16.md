# BannBonus / BNSmart — Consolidated Service & Booking Policy
Date: 2026-10-16 | Status: BUSINESS PROPOSAL — awaiting GOLD.md approval and implementation
Scope: initial operations Bang Yai / Bang Bua Thong, Nonthaburi. Do not imply deployed.

## Business model
BannBonus is a service-coordination platform for independent multi-trade contractors, not an employer imposing fixed labor/material prices. Technician evaluates labor, equipment, materials and scope on site; customer must explicitly approve quote before work and any additional work. Log versioned quote and approval, completion, receipt, complaint channel. No hidden charges.

## Booking and dispatch
Advance booking REQUEST is free. Request is NOT a confirmed booking. Human operator approval is mandatory. Do not charge before verifying technician eligibility/availability and disclosing terms. Show accurate statuses. Immediate dispatch only after customer confirms disclosed inspection/travel charge. Do not promise 24h actual technician availability. No technician -> no dispatch fee.

## Proposed dispatch/inspection fees (THB)
- Ordinary-rate service: 299 THB for road-route distance up to 5 km from assigned contractor's registered office/dispatch base to customer location.
- Night-rate service: 499 THB for the same first 5 km, from 22:00 through the 02:00 closing boundary.
- Beyond 5 km: propose +10 THB per additional road-route kilometer (configurable; exact rounding not yet approved).
- Determine night pricing at customer's confirmed dispatch time; show itemized calculation before approval.
- After 02:00, no NEW immediate emergency dispatch requests accepted; previously accepted work may continue. Whether 02:00:00 is accepted or closed should be fixed in implementation as an explicit boundary (recommended 02:00 closed).
- Normal service opening time NOT YET CONFIRMED. Do not infer 03:00 opening or publish Google Business hours until confirmed.
- Advance booking intake may remain online 24/7 while actual staffed hours are separately displayed.

## Completion incentive
After customer agrees to repair and job is completed, apply a fixed 100 THB discount against labor charges on that same job; not a refund of the full dispatch fee. Discount capped at actual labor charge; no negative amount. Material, equipment and extra-distance charge excluded. If no repair is authorized/completed, no discount; approved dispatch/inspection fee still applies. Display discount explicitly on final invoice.

## Financial and safety guardrails
- Labor and material prices are NOT fixed by platform; obtain explicit customer approval of technician quote.
- Separate customer-visible charges: base dispatch, excess distance, approved labor, approved materials, discount, total.
- Advance payment/deposit is not a blanket requirement; any risk-based deposit/cancellation policy requires separate approval and clear refund terms.
- Unsafe jobs can be declined/escalated. No automatic risk surcharge without customer approval.
- Technician minimum compensation, payment collection, tax treatment, refunds, and platform commission are OPEN DECISIONS.

## Implementation requirements (not implemented by this document)
Backend-authoritative configurable pricing with effective dates and tenant/zone rules; distance via actual road routing; booking vs dispatch state machine; operator approval; audit logs; versioned quote approvals; discount eligibility tied to completed job; customer and technician UI; test coverage for 5km threshold, 22:00 and 02:00 boundaries, cross-midnight dates, rounding, discount cap, cancellations, and failed payment. Avoid putting prices solely in UI. No production deploy without human review.

## Google Business Profile
Not updated. Opening hour unknown. Closing time for new emergency calls proposed 02:00; Google hours must reflect actual staffed operation, not 24-hour online request form. Require authorized business owner and verified access before changing listing.

## Governance
GOLD.md is canonical and currently states pricing/operating hours as open decisions. This proposal is a review artifact; it does NOT supersede GOLD.md or constitute deployed functionality. On owner approval, reconcile into GOLD.md through reviewed PR, then implement and test.
