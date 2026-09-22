# WARDLY

## Developer Implementation Specification

### Version 1.0 — Lean MVP

This document tells a developer exactly what to build for the Wardly MVP. It does not explain the business, the market, fundraising, or financial projections — those exist only where they change a database field, an API contract, a permission, or a status transition.

## Legend

| Marker | Meaning |
|---|---|
| P0 | Must be built before launch |
| P1 | Build after MVP is validated |
| P2 | Future / not scheduled |
| OPEN DECISION | Unresolved in the source documents. A temporary MVP behavior is specified so development is not blocked. Do not treat the temporary behavior as a final business decision. |

## CORE IMPLEMENTATION PRINCIPLE

Wardly launches as a Lean MVP operated manually by a 3-person founding team.

- No employee management system, payroll system, or office management system.
- No dedicated warehouse management system and no dedicated "Wardly Hub" infrastructure at launch — the physical hand-off-through-a-central-point workflow (see Section 8/10) still exists as a business rule, but it is tracked with simple manual status updates and evidence uploads by Admin, not a warehouse system.
- No automated payment orchestration, escrow, or split-payment system.
- No automated supplier scoring or buyer reputation algorithm.
- No AI moderation, OCR, or advanced fraud detection.
- Every workflow that can be run manually by Admin in this release should be — build the smallest reliable version that supports a real, end-to-end transaction, and build the data model so these areas can be automated later without a redesign.

## WHAT TO BUILD NOW — P0

Buyer Registration → Buyer Company Profile → RFQ Creation → Admin Review → Eligible Suppliers Receive RFQ → Suppliers Submit Offers → Buyer Compares Offers → Buyer Selects Offer → Order Created → Admin Manually Manages Order → Order Status Updates → Completion → Rating → Reorder.

Included: authentication; role-based access control; buyer/supplier/admin accounts; company profiles; supplier onboarding and verification status; category management; supplier capability/category assignment; RFQ creation, editing pre-publish, attachments, admin approval/rejection, distribution to eligible suppliers; supplier offer submission, editing pre-deadline, withdrawal; buyer offer comparison and selection; order creation, status tracking, manual admin management; basic internal notifications; basic identity/contact protection; basic contact-info blocking in messages; file access permissions; basic supplier performance recording and rating/review; reorder; admin dashboard; audit log.

## WHAT MUST NOT BE BUILT IN P0

Advanced OCR-based contact detection; AI moderation; advanced fraud detection; a complex automated anti-circumvention engine; a full automated supplier scoring algorithm; a full buyer reputation scoring algorithm; automated payment orchestration; escrow; split payments; complex shipping-provider integration; automated QC systems; a dedicated warehouse management system; advanced analytics; native mobile apps; multi-category expansion logic beyond keeping the architecture extensible. These may exist in the architecture as P1/P2 — do not spend P0 time building them.

## OPEN DECISIONS REGISTER (Consolidated)

These are unresolved in the source business/SRS documents. Each has a temporary MVP behavior so work is not blocked. Full detail is repeated at point of use in the relevant section.

| ID | Decision | Temporary MVP Behavior | Where Implemented |
|---|---|---|---|
| OD-P-01 | Legal/regulatory structure for handling buyer/supplier money (licensed provider vs. escrow vs. bank partnership) | OPEN DECISION — DO NOT IMPLEMENT UNTIL CONFIRMED. No payment gateway is integrated in P0. Buyer pays by an off-platform method agreed with Admin (e.g. bank transfer); Admin manually marks the order PAYMENT_CONFIRMED after verifying receipt outside the system. | Section 10 (Order Implementation), Section 15 |
| OD-P-02 | Final legal drafting of the Anti-Circumvention Policy and Privacy Policy | OPEN DECISION. Ship a placeholder Terms/Anti-Circumvention/Privacy text block with a mandatory "I agree" checkbox at registration. Replace the text before public launch; do not block engineering on the legal review. | Section 4 (Authentication) |
| OD-P-03 | Minimum supplier verification requirement before approval (docs only / site visit / both) | OPEN DECISION. P0 requires only a document upload (commercial registration document) reviewed manually by Admin. Do not build a site-visit scheduling feature. | Section 6, Section 7 |
| OD-P-04 | Dispute resolution mechanism (arbitration structure, timelines) | OPEN DECISION. P0 gives Admin a free-text resolution note and one of three manual outcomes (reopen_production, refund_manual, close_no_action). No SLA timers, no formal arbitration workflow. | Section 10, Section 15 |
| OD-P-05 | Sample policy and cost (always free vs. fee deducted from order) | OPEN DECISION. P0 treats samples as free — no fee field or billing logic. Revisit once payment integration (P1) exists. | Section 10 |
| OD-P-06 | Exact commission / logistics-margin / QC / handling fee rates | Not applicable to P0 — no payment or shipping integration exists yet, so no fee calculation is built. Store category/commission-rate as a simple admin-editable config value for later use, but do not compute or charge anything against it in P0. | Section 15 |

## SECTION 1 — SYSTEM OVERVIEW

Wardly is a B2B procurement marketplace. A Buyer posts a Request for Quotation (RFQ) describing what they need; eligible Suppliers in that product category submit competing offers; the Buyer compares offers on price and other factors and selects one, which creates an Order; the Admin manually tracks the order from payment through production, hand-off, and delivery, and it closes with a rating.

Three roles exist in P0:

- **Buyer** — a company sourcing goods. Creates RFQs, compares and accepts offers, tracks orders, rates suppliers, reorders.
- **Supplier** — a company selling goods. Manages its profile and category eligibility, browses RFQs it is eligible for, submits/edits/withdraws offers, executes won orders.
- **Admin** — the operating team. Approves suppliers and RFQs, distributes RFQs, moderates messages/files, manually manages every order from payment through delivery, handles disputes, and can suspend accounts.

Buyers and Suppliers never see each other's real identity or direct contact information at any point in the order cycle (Section 11). All product/category structure is designed to support more than one active category later, but only one category needs to be operational at launch — the schema must not need to be redesigned to add a second one.

## SECTION 2 — USER ROLES AND PERMISSIONS

**Implementation note:** the source documents describe additional internal actors (Ops, QC staff, Warehouse staff, Customer Support, Finance, Super Admin) for a later operating scale. For this lean MVP, all of those functions are performed by the single **Admin** role — do not build separate accounts/permission tiers for them yet. Keep the users.role enum extensible (Section 3) so those roles can be added later without a schema change beyond adding enum values.

### BUYER

Can:
- Register and manage own company profile.
- Create, edit (pre-publish only), and cancel own RFQs.
- Upload RFQ attachments.
- View offers submitted against own RFQs.
- Compare offers side-by-side.
- Select (accept) one offer per RFQ.
- View own orders and order status/timeline.
- Message the supplier on an active RFQ/order (monitored).
- Rate a supplier after order completion.
- Reorder from a past order.

Cannot:
- View supplier real company name, phone, email, WhatsApp, social handles, or exact address.
- Access another buyer's RFQs, offers, or orders.
- Access admin tools or another buyer's account data.
- Edit or publish an RFQ on another buyer's behalf.

### SUPPLIER

Can:
- Register and manage own company profile.
- Submit categories/capabilities for admin approval.
- View the RFQ feed filtered to categories it is approved for.
- Submit an offer on an eligible RFQ.
- Edit its own offer before the RFQ deadline and before it has been accepted/rejected.
- Withdraw its own offer before acceptance.
- View orders it has won and update the order fields it is permitted to update (production status, sample evidence).
- View its own basic performance data (completed orders, average rating).

Cannot:
- View buyer real company name, phone, email, WhatsApp, social handles, or exact delivery address.
- View another supplier's offers on the same RFQ.
- View or edit another supplier's data.
- Access admin tools.
- Set its own verification status or category approval.

### ADMIN

Can:
- Manage users (view, suspend, reactivate).
- Approve or reject supplier verification and category applications.
- Review, approve, or reject submitted RFQs.
- Manage categories (activate/deactivate, mark "coming soon").
- Manually control which eligible suppliers a published RFQ is distributed to (default = all approved suppliers in that category, with the ability to add/remove specific suppliers).
- Monitor offers and flag suspicious ones.
- Manually manage every order: advance/roll back status (with reason), log Hub receipt, log QC result, log shipment hand-off, log delivery.
- Review flagged messages/files and act on circumvention attempts (warn/strike/suspend/ban).
- Open, investigate, and resolve disputes.
- Add internal notes to any RFQ, offer, order, or user record.
- Suspend or ban a user account.
- View the audit log.

Cannot (P0):
- Nothing is technically restricted for Admin in P0 (single internal role) — every admin action must still write an audit log entry (Section 19); this is a logging requirement, not a permission gate.

### Permissions Matrix

| Resource | Action | Allowed Roles | Conditions |
|---|---|---|---|
| Organization/Company Profile | Create/Edit | Buyer, Supplier | Own organization only |
| Organization/Company Profile | View | Buyer, Supplier, Admin | Own org (self); Admin sees all; counterpart sees only the masked/anonymized fields (Section 11) |
| RFQ | Create | Buyer | Verified buyer account, active category |
| RFQ | Edit | Buyer | Own RFQ, status = DRAFT or SUBMITTED (not yet approved) only |
| RFQ | Cancel | Buyer | Own RFQ, status not AWARDED/CLOSED |
| RFQ | Approve/Reject | Admin | Status = UNDER_REVIEW |
| RFQ | View (full detail) | Buyer (own), Admin (all) | — |
| RFQ | View (feed listing) | Supplier | Status = PUBLISHED/RECEIVING_OFFERS, category = supplier's approved category |
| Offer | Create | Supplier | RFQ status = PUBLISHED/RECEIVING_OFFERS, supplier approved for RFQ's category, before RFQ deadline |
| Offer | Edit | Supplier | Own offer, status = SUBMITTED/UNDER_REVIEW, before RFQ deadline, not yet accepted/rejected |
| Offer | Withdraw | Supplier | Own offer, not yet accepted |
| Offer | View (comparison) | Buyer | Own RFQ's offers only, contact fields masked |
| Offer | Accept | Buyer | Own RFQ, offer status = SUBMITTED/UNDER_REVIEW |
| Offer | Monitor/Flag | Admin | Any offer |
| Order | View | Buyer (own), Supplier (own), Admin (all) | — |
| Order | Update status | Admin | Per allowed transitions (Section 10) |
| Order | Update production/sample fields | Supplier | Own won order, permitted fields only |
| Order | Approve/reject sample | Buyer | Own order, status = SAMPLE_REVIEW |
| Rating | Create | Buyer | Own order, status = DELIVERED/COMPLETED, one rating per order |
| Rating | View | Buyer, Supplier, Admin | Supplier sees aggregate + own; buyer sees own submissions; Admin sees all |
| Category | Manage | Admin | — |
| Supplier Verification | Approve/Reject | Admin | Status = pending |
| Supplier Category Assignment | Approve/Reject | Admin | — |
| Message | Send | Buyer, Supplier | Active conversation tied to own RFQ/order |
| Message | View all / Flag | Admin | — |
| File | Upload | Buyer, Supplier | Owner of parent RFQ/offer |
| File | View preview | Counterpart role | RFQ published and file type = preview-eligible |
| File | View original | Awarded supplier only, Buyer (own), Admin | Order exists and requesting user = order.buyer_id or order.supplier_id |
| User | Suspend/Ban | Admin | — |
| Audit Log | View | Admin | — |
| Dispute | Open | Buyer, Supplier, Admin | Order exists |
| Dispute | Resolve | Admin | — |

## SECTION 3 — DATABASE DESIGN

General conventions: every table has id (UUID, PK), created_at, updated_at (timestamps, default now) unless noted. Foreign keys are ON DELETE RESTRICT unless noted. All money fields are decimal, not float.

### users

Purpose: authentication and role identity.

| Field | Type | Req | Default | Allowed Values / FK | Notes |
|---|---|---|---|---|---|
| id | UUID | Yes | gen_random_uuid() | PK | |
| email | string | Yes | — | unique | |
| password_hash | string | Yes | — | — | |
| role | enum | Yes | — | buyer, supplier, admin | extensible enum |
| status | enum | Yes | active | active, suspended, banned | |
| email_verified_at | timestamp | No | null | — | |
| last_login_at | timestamp | No | null | — | |

Indexes: unique(email); index(role, status).

### organizations

Purpose: the company behind a buyer or supplier account.

| Field | Type | Req | Default | Allowed Values / FK | Notes |
|---|---|---|---|---|---|
| id | UUID | Yes | — | PK | |
| owner_user_id | UUID | Yes | — | FK → users.id | |
| type | enum | Yes | — | buyer, supplier | |
| legal_name | string | Yes | — | — | never shown to counterpart (Section 11) |
| display_name | string | No | null | — | e.g. "Supplier #2847"-style anonymized label, system-generated on approval |
| country | string | Yes | — | — | |
| general_region | string | Yes | — | — | shown to counterpart |
| exact_address | string | No | null | — | never shown to counterpart; used only for Hub/shipping ops |
| tax_id | string | No | null | — | |
| logo_file_id | UUID | No | null | FK → files.id | shown to counterpart only when attached to an in-production order (Section 11) |

Indexes: index(type).

### buyer_profiles

| Field | Type | Req | Default | Allowed Values / FK | Notes |
|---|---|---|---|---|---|
| id | UUID | Yes | — | PK | |
| organization_id | UUID | Yes | — | FK → organizations.id, unique | 1:1 |
| verified | boolean | Yes | false | — | admin-set |

### supplier_profiles

| Field | Type | Req | Default | Allowed Values / FK | Notes |
|---|---|---|---|---|---|
| id | UUID | Yes | — | PK | |
| organization_id | UUID | Yes | — | FK → organizations.id, unique | 1:1 |
| anonymized_id | string | Yes | — | unique | e.g. "Supplier #2847", generated on approval |
| verification_status | enum | Yes | pending | pending, verified, rejected | |
| completed_orders_count | integer | Yes | 0 | — | denormalized counter, updated on order COMPLETED |
| average_rating | decimal(3,2) | No | null | 1.00–5.00 | denormalized, recomputed on new rating |

Indexes: unique(anonymized_id); index(verification_status).

Wardly Score / tier and Buyer Reputation are **P1** (Section 20) — the source explicitly states final scoring weights are undefined and must not be invented. P0 ships only the two raw counters above.

### categories

| Field | Type | Req | Default | Allowed Values / FK | Notes |
|---|---|---|---|---|---|
| id | UUID | Yes | — | PK | |
| name | string | Yes | — | unique | |
| status | enum | Yes | coming_soon | active, coming_soon | |
| phase | integer | Yes | 1 | — | rollout phase label, informational only |

### supplier_categories

Purpose: which categories a supplier is approved to see/quote in, and its stated capability for that category.

| Field | Type | Req | Default | Allowed Values / FK | Notes |
|---|---|---|---|---|---|
| id | UUID | Yes | — | PK | |
| supplier_id | UUID | Yes | — | FK → supplier_profiles.id | |
| category_id | UUID | Yes | — | FK → categories.id | |
| approved | boolean | Yes | false | — | admin-set |
| approved_at | timestamp | No | null | — | |
| production_capacity | string | No | null | — | free text, e.g. "50,000 units/month" |
| materials_supported | string[] | No | null | — | |

Constraints: unique(supplier_id, category_id).

### supplier_verifications

Purpose: document review trail (OD-P-03: document upload only in P0).

| Field | Type | Req | Default | Allowed Values / FK | Notes |
|---|---|---|---|---|---|
| id | UUID | Yes | — | PK | |
| supplier_id | UUID | Yes | — | FK → supplier_profiles.id | |
| document_type | enum | Yes | — | commercial_registration, certificate, other | |
| file_id | UUID | Yes | — | FK → files.id | |
| status | enum | Yes | pending | pending, verified, rejected | |
| reviewed_by | UUID | No | null | FK → users.id (admin) | |
| reviewed_at | timestamp | No | null | — | |
| rejection_reason | string | No | null | — | |

### rfqs

| Field | Type | Req | Default | Allowed Values / FK | Notes |
|---|---|---|---|---|---|
| id | UUID | Yes | — | PK | |
| buyer_id | UUID | Yes | — | FK → buyer_profiles.id | |
| category_id | UUID | Yes | — | FK → categories.id | |
| title | string | Yes | — | max 150 chars | |
| quantity | decimal | Yes | — | > 0 | |
| unit | string | Yes | — | — | e.g. "pcs", "cartons" |
| dimensions | string | No | null | — | |
| material | string | No | null | — | |
| technical_specs | JSON | No | null | — | free-form key/value |
| printing_customization | string | No | null | — | |
| delivery_deadline | date | Yes | — | must be future date at publish | |
| delivery_region | string | Yes | — | region-level only, never exact address | |
| quality_requirements | string | No | null | — | |
| sample_required | boolean | Yes | false | — | |
| certifications_required | string | No | null | — | |
| legal_compliance_requirements | string | No | null | — | |
| status | enum | Yes | DRAFT | see Section 8.1 | |
| rejection_reason | string | No | null | — | set on admin reject |
| admin_notes | string | No | null | — | internal only, never shown to buyer/supplier |
| offer_deadline_at | timestamp | Yes | — | must be future at publish | |
| published_at | timestamp | No | null | — | |
| source_rfq_id | UUID | No | null | FK → rfqs.id (self) | set when created via Reorder |

Indexes: index(buyer_id, status); index(category_id, status).

### rfq_items

Purpose: optional multi-line items on one RFQ.

| Field | Type | Req | Default | Allowed Values / FK | Notes |
|---|---|---|---|---|---|
| id | UUID | Yes | — | PK | |
| rfq_id | UUID | Yes | — | FK → rfqs.id | |
| item_name | string | Yes | — | — | |
| quantity | decimal | Yes | — | > 0 | |
| unit | string | Yes | — | — | |

### rfq_attachments

| Field | Type | Req | Default | Allowed Values / FK | Notes |
|---|---|---|---|---|---|
| id | UUID | Yes | — | PK | |
| rfq_id | UUID | Yes | — | FK → rfqs.id | |
| file_id | UUID | Yes | — | FK → files.id | |
| type | enum | Yes | — | design, certificate, other | |
| contains_identity_risk | boolean | Yes | false | — | true = logo/artwork requiring watermark + gated original (Section 11/12) |

### offers

| Field | Type | Req | Default | Allowed Values / FK | Notes |
|---|---|---|---|---|---|
| id | UUID | Yes | — | PK | |
| rfq_id | UUID | Yes | — | FK → rfqs.id | |
| supplier_id | UUID | Yes | — | FK → supplier_profiles.id | |
| unit_price | decimal | Yes | — | > 0 | |
| moq | decimal | Yes | — | > 0 | |
| production_lead_time_days | integer | Yes | — | > 0 | |
| delivery_time_estimate_days | integer | Yes | — | > 0 | |
| shipping_estimate_notes | string | No | null | — | free text estimate, no live rate in P0 |
| sample_availability | boolean | Yes | false | — | |
| sample_terms | string | No | null | — | |
| payment_terms | string | No | null | — | |
| technical_specs_notes | string | No | null | — | |
| quality_notes | string | No | null | — | |
| status | enum | Yes | SUBMITTED | see Section 9.2 | |
| submitted_at | timestamp | Yes | now() | — | |
| withdrawn_at | timestamp | No | null | — | |

Constraints: unique(rfq_id, supplier_id) — one active offer per supplier per RFQ (edit in place, do not allow duplicate rows). Indexes: index(rfq_id, status); index(supplier_id, status).

### offer_items

Purpose: line-level pricing when the RFQ has rfq_items.

| Field | Type | Req | Default | Allowed Values / FK | Notes |
|---|---|---|---|---|---|
| id | UUID | Yes | — | PK | |
| offer_id | UUID | Yes | — | FK → offers.id | |
| rfq_item_id | UUID | No | null | FK → rfq_items.id | |
| description | string | Yes | — | — | |
| unit_price | decimal | Yes | — | > 0 | |
| quantity | decimal | Yes | — | > 0 | |

### offer_attachments

| Field | Type | Req | Default | Allowed Values / FK | Notes |
|---|---|---|---|---|---|
| id | UUID | Yes | — | PK | |
| offer_id | UUID | Yes | — | FK → offers.id | |
| file_id | UUID | Yes | — | FK → files.id | |
| type | enum | Yes | — | certificate, photo, other | |

### orders

| Field | Type | Req | Default | Allowed Values / FK | Notes |
|---|---|---|---|---|---|
| id | UUID | Yes | — | PK | |
| rfq_id | UUID | Yes | — | FK → rfqs.id, unique | |
| offer_id | UUID | Yes | — | FK → offers.id | the accepted offer |
| buyer_id | UUID | Yes | — | FK → buyer_profiles.id | |
| supplier_id | UUID | Yes | — | FK → supplier_profiles.id | |
| status | enum | Yes | OFFER_SELECTED | see Section 10.1 | |
| sample_required | boolean | Yes | false | — | copied from RFQ at creation |
| admin_notes | string | No | null | — | internal only |
| created_at | timestamp | Yes | now() | — | |

Indexes: index(buyer_id, status); index(supplier_id, status).

### order_status_history

| Field | Type | Req | Default | Allowed Values / FK | Notes |
|---|---|---|---|---|---|
| id | UUID | Yes | — | PK | |
| order_id | UUID | Yes | — | FK → orders.id | |
| from_status | enum | No | null | — | |
| to_status | enum | Yes | — | — | |
| changed_by | UUID | Yes | — | FK → users.id | |
| evidence_file_id | UUID | No | null | FK → files.id | photo/report for Hub receipt, QC, delivery |
| note | string | No | null | — | |
| changed_at | timestamp | Yes | now() | — | |

Indexes: index(order_id, changed_at).

### ratings

| Field | Type | Req | Default | Allowed Values / FK | Notes |
|---|---|---|---|---|---|
| id | UUID | Yes | — | PK | |
| order_id | UUID | Yes | — | FK → orders.id, unique | one rating per order |
| buyer_id | UUID | Yes | — | FK → buyer_profiles.id | |
| supplier_id | UUID | Yes | — | FK → supplier_profiles.id | |
| score | integer | Yes | — | 1–5 | |
| comment | string | No | null | max 1000 chars | |
| created_at | timestamp | Yes | now() | — | |

### notifications

| Field | Type | Req | Default | Allowed Values / FK | Notes |
|---|---|---|---|---|---|
| id | UUID | Yes | — | PK | |
| user_id | UUID | Yes | — | FK → users.id | |
| event_type | string | Yes | — | see Section 14 | |
| channel | enum | Yes | in_app | in_app, email | |
| message | string | Yes | — | — | |
| link | string | No | null | — | deep link to relevant screen |
| read | boolean | Yes | false | — | |
| sent_at | timestamp | Yes | now() | — | |

Indexes: index(user_id, read).

### conversations

| Field | Type | Req | Default | Allowed Values / FK | Notes |
|---|---|---|---|---|---|
| id | UUID | Yes | — | PK | |
| rfq_id | UUID | No | null | FK → rfqs.id | |
| order_id | UUID | No | null | FK → orders.id | |
| buyer_id | UUID | Yes | — | FK → buyer_profiles.id | |
| supplier_id | UUID | Yes | — | FK → supplier_profiles.id | |

Constraints: exactly one of rfq_id/order_id set; unique(rfq_id, supplier_id) where rfq_id is not null.

### messages

| Field | Type | Req | Default | Allowed Values / FK | Notes |
|---|---|---|---|---|---|
| id | UUID | Yes | — | PK | |
| conversation_id | UUID | Yes | — | FK → conversations.id | |
| sender_id | UUID | Yes | — | FK → users.id | |
| content | string | Yes | — | max 2000 chars | |
| masked_content | string | No | null | — | content with detected patterns redacted, shown to counterpart if flagged-but-delivered rule applies (Section 13) |
| flagged | boolean | Yes | false | — | |
| created_at | timestamp | Yes | now() | — | |

Indexes: index(conversation_id, created_at).

### message_flags

Purpose: contact-info / circumvention detection results (also covers "file access permissions" flag events referenced from Section 12).

| Field | Type | Req | Default | Allowed Values / FK | Notes |
|---|---|---|---|---|---|
| id | UUID | Yes | — | PK | |
| message_id | UUID | Yes | — | FK → messages.id | |
| detected_pattern_type | enum | Yes | — | phone, email, url, other | |
| matched_text | string | Yes | — | — | for admin review only |
| status | enum | Yes | pending_review | pending_review, warning, strike, suspension, ban, dismissed | |
| reviewed_by | UUID | No | null | FK → users.id | |
| reviewed_at | timestamp | No | null | — | |

### files

| Field | Type | Req | Default | Allowed Values / FK | Notes |
|---|---|---|---|---|---|
| id | UUID | Yes | — | PK | |
| uploader_id | UUID | Yes | — | FK → users.id | |
| storage_key | string | Yes | — | — | object storage path |
| original_filename | string | Yes | — | — | |
| mime_type | string | Yes | — | see Section 12 allowed list | |
| size_bytes | integer | Yes | — | ≤ configured max (Section 12) | |
| is_preview_watermarked | boolean | Yes | false | — | |
| deleted_at | timestamp | No | null | — | soft delete |

### audit_logs

| Field | Type | Req | Default | Allowed Values / FK | Notes |
|---|---|---|---|---|---|
| id | UUID | Yes | — | PK | |
| actor_id | UUID | No | null | FK → users.id | null = system |
| action | string | Yes | — | e.g. rfq.approved, order.status_changed | |
| entity_type | string | Yes | — | — | |
| entity_id | UUID | Yes | — | — | |
| before_state | JSON | No | null | — | |
| after_state | JSON | No | null | — | |
| created_at | timestamp | Yes | now() | — | |

Indexes: index(entity_type, entity_id); index(actor_id, created_at).

### 3.1 Entity Relationship Diagram

```
erDiagram
USERS ||--o{ ORGANIZATIONS : owns
ORGANIZATIONS ||--o| BUYER_PROFILES : "is a buyer"
ORGANIZATIONS ||--o| SUPPLIER_PROFILES : "is a supplier"
SUPPLIER_PROFILES ||--o{ SUPPLIER_CATEGORIES : approved_for
SUPPLIER_PROFILES ||--o{ SUPPLIER_VERIFICATIONS : submits
CATEGORIES ||--o{ SUPPLIER_CATEGORIES : includes
CATEGORIES ||--o{ RFQS : classifies
BUYER_PROFILES ||--o{ RFQS : creates
RFQS ||--o{ RFQ_ITEMS : contains
RFQS ||--o{ RFQ_ATTACHMENTS : contains
RFQS ||--o{ OFFERS : receives
SUPPLIER_PROFILES ||--o{ OFFERS : submits
OFFERS ||--o{ OFFER_ITEMS : contains
OFFERS ||--o{ OFFER_ATTACHMENTS : contains
RFQS ||--o| ORDERS : produces
OFFERS ||--o| ORDERS : "accepted into"
ORDERS ||--o{ ORDER_STATUS_HISTORY : logs
ORDERS ||--o| RATINGS : generates
RFQS ||--o{ CONVERSATIONS : opens
ORDERS ||--o{ CONVERSATIONS : opens
CONVERSATIONS ||--o{ MESSAGES : contains
MESSAGES ||--o{ MESSAGE_FLAGS : may_flag
USERS ||--o{ NOTIFICATIONS : receives
USERS ||--o{ FILES : uploads
USERS ||--o{ AUDIT_LOGS : generates
```

## SECTION 4 — AUTHENTICATION

### Registration

- Two self-service registration flows: Buyer and Supplier. Fields: email, password, company legal name, country, general region, role (fixed by which flow was used, immutable after creation).
- Admin accounts are **not** self-registrable — created directly in the database/an internal seed script for the 3-person team in P0. No admin sign-up UI.
- Supplier registration additionally requires: at least one category selection and one commercial_registration document upload (OD-P-03) before the account can be submitted for verification.
- At registration, both Buyer and Supplier must check an "I agree to the Terms, Anti-Circumvention Policy, and Privacy Policy" box (OD-P-02 placeholder text) before the account is created.

### Login

- Email + password. On success, issue a session token (JWT, 24h expiry) + refresh token (30 days).
- 5 failed attempts within 15 minutes locks the account for 15 minutes (basic brute-force protection).

### Logout

- Invalidates the refresh token server-side; client discards both tokens.

### Password reset

- "Forgot password" sends a time-limited (1 hour) single-use reset link to the registered email. Resetting invalidates all existing sessions for that user.

### Email verification

- Required. A verification link is emailed on registration. Until verified, the account can log in but cannot publish an RFQ (Buyer) or submit an offer (Supplier) — enforced at the API layer, not just hidden in the UI.

### Role assignment

- Fixed at registration by which flow created the account (buyer or supplier). admin is assigned only by direct database provisioning. Role is never user-editable after creation.

### Session handling

- JWT bearer token on every authenticated request. Refresh endpoint issues a new access token from a valid refresh token. Expired/invalid token → 401 Unauthorized.

### Unauthorized access behavior

- No token / invalid token → 401, redirect to login.
- Valid token, wrong role/ownership for the resource → 403 Forbidden, generic "You don't have access to this" message (never reveal that the resource exists if it belongs to a different buyer/supplier).

### Account suspension behavior

- A suspended or banned user cannot log in (403 with a message telling them to contact support); any existing session is invalidated immediately server-side on suspension.

## SECTION 5 — BUYER IMPLEMENTATION

### 5.1 Registration / Login — /register, /login

- Purpose: create a buyer account or authenticate.
- Components: tabbed form (Buyer/Supplier on register), email/password fields, "forgot password" link.
- Fields: email, password, confirm password, company legal name, country, general region, terms checkbox.
- Validation: valid email format, unique email, password ≥ 8 chars with 1 number, confirm-password match, terms checkbox required.
- Buttons: "Create account", "Log in", "Forgot password?".
- Success: account created → email verification screen; login success → Buyer Dashboard.
- Error: inline field errors; duplicate email → "An account with this email already exists."
- Loading: disable submit button, show spinner during request.

### 5.2 Buyer Dashboard — /buyer/dashboard

- Purpose: landing page after login; category selection + quick access to active RFQs/orders.
- Components: category grid (active categories clickable, "coming soon" categories disabled/greyed), "Create RFQ" CTA, summary cards (open RFQs, offers awaiting review, active orders).
- Empty state: "You have no RFQs yet — create your first one." with CTA.
- Loading: skeleton cards while summary counts load.

### 5.3 Company Profile — /buyer/profile

- Purpose: manage own organization details.
- Fields: legal name, country, general region, tax ID (optional), exact address (internal use only, never shown to supplier).
- Validation: legal name required, country required.
- Buttons: "Save changes".
- Success: toast "Profile updated."
- Error: inline validation errors; save failure → toast "Could not save, try again."

### 5.4 Create RFQ — /buyer/rfqs/new

- Purpose: build and submit an RFQ for admin review.
- Components: multi-step form: (1) category select, (2) product details, (3) requirements & deadline, (4) attachments, (5) review & submit.
- Fields: category, title, quantity, unit, dimensions, material, technical specs (key/value repeatable), printing/customization notes, delivery deadline, delivery region, quality requirements, sample required (toggle), certifications required, legal/compliance requirements, attachments (files), offer deadline.
- Validation: category/title/quantity/unit/delivery deadline/delivery region/offer deadline required; offer deadline and delivery deadline must be future dates; quantity > 0; at least one attachment required if printing_customization is filled (artwork implied).
- Buttons: "Save as Draft", "Submit for Review", step Back/Next.
- Success: Submit → RFQ status SUBMITTED, redirect to RFQ Details with a "pending admin review" banner.
- Error: validation errors shown per field per step; cannot advance a step with errors.
- Empty/Loading: n/a (form screen).

### 5.5 RFQ Details — /buyer/rfqs/:id

- Purpose: full read view of one RFQ plus its offers.
- Components: RFQ summary card, status badge, attachments list, offers table (link to Offer Comparison), admin rejection reason banner if REJECTED.
- Buttons: "Edit" (only if status is DRAFT/SUBMITTED), "Cancel RFQ" (if not AWARDED/CLOSED), "Compare Offers" (if ≥1 offer).
- Empty state: "No offers yet" once published with 0 offers.
- Loading: skeleton while RFQ loads.

### 5.6 Edit RFQ — /buyer/rfqs/:id/edit

- Purpose: modify an RFQ that has not yet been approved/published.
- Components: same form as Create RFQ, pre-filled.
- Validation: same as 5.4. Enforced rule: only editable while status is DRAFT or SUBMITTED; if status has advanced past that, the Edit route returns 403 with "This RFQ can no longer be edited — cancel it and create a new one instead."
- Buttons: "Save changes", "Resubmit for Review" (if it was previously REJECTED).
- Success: returns to RFQ Details.

### 5.7 My RFQs — /buyer/rfqs

- Purpose: list of all RFQs created by this buyer.
- Components: table (title, category, status, offers count, created date), status filter, search by title.
- Empty state: "You haven't created any RFQs yet."
- Loading: skeleton rows.

### 5.8 Offer Comparison — /buyer/rfqs/:id/offers

- Purpose: compare all offers on one RFQ side by side, without any auto-ranking or auto-selection.
- Components: comparison table/cards: supplier anonymized ID, price, MOQ, production lead time, delivery time estimate, shipping estimate notes, sample availability, payment terms, technical notes, quality notes, attachments, completed orders count, average rating. Sort/filter controls on any single column.
- Explicitly excluded from this view: supplier legal name, phone, email, WhatsApp, social handles, exact address (Section 11).
- Buttons: "Accept Offer" per row (with confirmation dialog stating this rejects all other offers on the RFQ), "View Attachments".
- Empty state: "No offers received yet."
- Error: accepting an already-accepted/withdrawn offer → 409 Conflict, toast "This offer is no longer available, please refresh."

### 5.9 Order Details — /buyer/orders/:id

- Purpose: full detail of one order.
- Components: order summary (product, price, supplier anonymized ID), current status badge, sample approval panel (if SAMPLE_REVIEW), message thread link, "Rate Supplier" button (post-delivery).
- Buttons: "Approve Sample" / "Reject Sample" (only when status = SAMPLE_REVIEW), "Open Dispute", "Rate Supplier" (only when status = DELIVERED/COMPLETED and not yet rated), "Reorder".

### 5.10 Order Tracking — /buyer/orders/:id/tracking

- Purpose: visual timeline of order status history.
- Components: vertical timeline built from order_status_history, each entry with timestamp, status label, and evidence photo/report link if present.
- Empty state: n/a — always has at least the OFFER_SELECTED entry.

### 5.11 Ratings — /buyer/orders/:id/rate

- Purpose: submit a 1–5 rating + comment after delivery.
- Fields: score (1–5 stars), comment (optional, max 1000 chars).
- Validation: score required; one rating per order (route returns 409 if already rated).
- Buttons: "Submit Rating".
- Success: redirect to Order Details with rating shown.

### 5.12 Reorder — triggered from Order Details / My RFQs, lands on /buyer/rfqs/new?from_order=:id

- Purpose: pre-fill a new RFQ from a completed order's original RFQ.
- Behavior: pre-fills all RFQ fields (category, quantity, specs, etc.) from rfqs.source order's RFQ; buyer can edit any field before submitting; works across categories, not just the original one.
- Buttons: same as Create RFQ.

## SECTION 6 — SUPPLIER IMPLEMENTATION

### 6.1 Registration / Login — /register, /login

- Same mechanics as Section 5.1, "Supplier" tab. Additional fields: at least one category selection, one commercial_registration document upload.
- Success: account created with verification_status = pending; redirected to Verification Status screen, not the RFQ feed.

### 6.2 Company Profile — /supplier/profile

- Same field set/behavior as Section 5.3, plus display_name/anonymized_id shown read-only once assigned at approval.

### 6.3 Verification Status — /supplier/verification

- Purpose: show current document review status; block RFQ access until verified.
- Components: status badge (pending/verified/rejected), uploaded documents list, rejection reason banner if rejected, re-upload control if rejected.
- Buttons: "Upload additional document", "Resubmit".
- Empty/Loading: n/a.

### 6.4 Capabilities — /supplier/categories

- Purpose: apply for additional categories and describe production capability.
- Fields: category (select from active categories), production capacity (free text), materials supported (repeatable tags).
- Validation: category required; cannot re-apply to a category already approved = true or with a pending application.
- Buttons: "Apply for Category".
- Success: creates a supplier_categories row with approved = false, pending admin review.

### 6.5 Available RFQs — /supplier/rfqs

- Purpose: feed of RFQs the supplier is eligible to quote on.
- Components: table/cards filtered to category_id ∈ approved categories and status ∈ {PUBLISHED, RECEIVING_OFFERS}, with countdown to offer deadline.
- Empty state: "No RFQs available in your categories yet."
- Loading: skeleton rows.

### 6.6 RFQ Details — /supplier/rfqs/:id

- Purpose: full RFQ detail for quoting, with buyer identity masked and attachments shown as watermarked previews only.
- Buttons: "Submit Offer" (if not already offered and before deadline), "View My Offer" (if already offered).

### 6.7 Submit Offer — /supplier/rfqs/:id/offer/new

- Purpose: submit the unified offer form.
- Fields: unit price, MOQ, production lead time (days), delivery time estimate (days), shipping estimate notes, sample availability (toggle) + terms, payment terms, technical specs notes, quality notes, attachments (certificates/photos).
- Validation: unit_price/moq/production_lead_time_days/delivery_time_estimate_days required and > 0; RFQ must be PUBLISHED/RECEIVING_OFFERS and before offer_deadline_at; supplier must be approved for the RFQ's category; one active offer per supplier per RFQ (route returns 409 if one exists — send them to Edit instead).
- Buttons: "Submit Offer".
- Success: offer status SUBMITTED, buyer notified, redirect to My Offers.
- Error: deadline passed → 403 "This RFQ is no longer accepting offers."

### 6.8 Edit Offer — /supplier/offers/:id/edit

- Purpose: modify a submitted offer before the deadline and before any decision.
- Enforced rule: editable only while offers.status = SUBMITTED (or UNDER_REVIEW) and now() < rfq.offer_deadline_at. Otherwise 403.
- Buttons: "Save Changes", "Withdraw Offer" (confirmation dialog).

### 6.9 My Offers — /supplier/offers

- Purpose: track all offers submitted by this supplier.
- Components: table (RFQ title, price, status, submitted date), status filter.
- Empty state: "You haven't submitted any offers yet."

### 6.10 Won Orders — /supplier/orders

- Purpose: list orders where this supplier's offer was accepted.
- Components: table (RFQ title, buyer general region, status, created date), status filter.
- Empty state: "No orders yet."

### 6.11 Order Details — /supplier/orders/:id

- Purpose: execute a won order.
- Components: order summary, current status, permitted update controls: "Mark Production Started" (when PAYMENT_CONFIRMED), sample evidence upload + "Submit Sample" (when sample_required and status = PRODUCTION), "Mark Production Completed" (when PRODUCTION and sample approved or not required).
- Buttons/behavior: each button only enabled when the order is in the exact prerequisite status (Section 10); attempting otherwise is disabled client-side and rejected 409 server-side.
- Note: Hub receipt, QC, courier hand-off, and delivery stages are Admin-only updates (Section 7); the supplier sees them read-only on this screen.

### 6.12 Basic Performance / Ratings — /supplier/performance

- Purpose: show the supplier its own basic performance data.
- Components: completed_orders_count, average_rating, list of individual ratings received (score + comment, buyer identity masked).
- Empty state: "No completed orders yet."

## SECTION 7 — ADMIN IMPLEMENTATION

All screens below require role = admin. Every action listed with a confirmation dialog must, on confirm, write an audit_logs row before returning success.

### 7.1 Admin Dashboard — /admin

- Tables/cards: pending supplier approvals count, RFQs awaiting review count, flagged messages count, open disputes count, orders by status (bar breakdown).
- Actions: click-through to each queue.
- Filters: none (summary screen).

### 7.2 User Management — /admin/users

- Table: email, role, org name, status, created date.
- Filters/Search: role, status, search by email/org name.
- Actions: view detail, suspend, reactivate, ban.
- Confirmation dialogs: suspend/ban require a reason (free text, stored on the audit log entry).
- Bulk actions: none in P0 (avoid bulk destructive actions this early).

### 7.3 Supplier Verification — /admin/suppliers/verification

- Table: company name, submitted documents, status, applied categories, submitted date.
- Filters/Search: status, category.
- Actions: view documents, "Approve" (sets verification_status = verified, generates anonymized_id), "Reject" (requires reason).
- Confirmation dialogs: required on both approve and reject.
- Bulk actions: bulk approve/reject for the pending queue.

### 7.4 Category Management — /admin/categories

- Table: name, status, phase.
- Actions: create category, activate/deactivate (toggles active/coming_soon).
- Confirmation dialogs: deactivating a category with open RFQs warns "N RFQs are currently open in this category" before confirming.

### 7.5 Supplier Capability Management — /admin/suppliers/:id/categories

- Table: category, production capacity text, materials, approval status.
- Actions: approve/reject a category application.
- Confirmation dialogs: none required (low-risk, reversible).

### 7.6 RFQ Review — /admin/rfqs/review

- Table: title, buyer org, category, quantity, submitted date.
- Filters/Search: category, search by title/buyer.
- Actions: open detail, "Approve" (status → PUBLISHED, notifies eligible suppliers), "Reject" (requires reason, status → REJECTED, buyer notified).
- Confirmation dialogs: required on both.
- Bulk actions: none (each RFQ needs individual review for content correctness).

### 7.7 RFQ Distribution — /admin/rfqs/:id/distribution

- Purpose: default distribution is "all suppliers approved for this category"; this screen lets Admin add/remove specific suppliers for a given RFQ.
- Table: eligible suppliers list with include/exclude toggle.
- Actions: save distribution list; re-notify a supplier manually.
- Filters/Search: search by supplier anonymized ID.

### 7.8 Offer Monitoring — /admin/offers

- Table: RFQ title, supplier anonymized ID, price, status, submitted date.
- Filters/Search: RFQ, supplier, status.
- Actions: "Flag Suspicious" (adds admin_notes, does not block the offer automatically).

### 7.9 Order Management — /admin/orders

- Table: RFQ title, buyer org, supplier anonymized ID, status, created date.
- Filters/Search: status, category, buyer, supplier.
- Actions: open Order Status Update screen.

### 7.10 Order Status Update — /admin/orders/:id

- Purpose: the primary manual-operations screen — Admin drives the order through every post-selection stage.
- Components: current status, allowed-next-status buttons per Section 10.2, evidence upload field (required for Hub receipt, QC result, delivery confirmation), free-text note field, full status history timeline, internal notes panel.
- Actions: advance status (per allowed transitions only — invalid transitions are not selectable), record QC result (pass/fail/conditional_pass), mark payment confirmed, open dispute.
- Confirmation dialogs: required on every status change, showing "from → to" explicitly.
- Permission requirements: admin only.

### 7.11 User Suspension — covered within 7.2 (no separate screen; listed here per spec template for completeness).

### 7.12 Message Flag Review — /admin/messages/flags

- Table: flagged message excerpt, sender, detected pattern type, conversation link, status.
- Filters/Search: status, pattern type, date.
- Actions: "Dismiss" (false positive), "Warning", "Strike", "Suspend", "Ban" — each writes to message_flags.status and triggers the corresponding user notification and audit log entry (Section 12.1 escalation ladder).
- Confirmation dialogs: required for warning/strike/suspend/ban.
- Bulk actions: bulk dismiss for obvious false positives.

### 7.13 Dispute Management — /admin/disputes

- Table: order, raised by, category, status, created date.
- Filters/Search: status, order.
- Actions: open detail, add investigation notes, resolve with outcome = reopen_production | refund_manual | close_no_action (OD-P-04).
- Confirmation dialogs: required on resolve, since it changes the underlying order status.

### 7.14 Audit Logs — /admin/audit-logs

- Table: timestamp, actor, action, entity type/id.
- Filters/Search: actor, entity type, date range.
- Actions: view before/after state diff, export (CSV).
- Bulk actions: export only.

## SECTION 8 — RFQ IMPLEMENTATION

### 8.1 RFQ Statuses

The source's raw state list (Draft → Validating → Published → ReceivingOffers → OfferSelected/Expired/Cancelled) is adjusted here to add an explicit **Admin Review** gate, because the required P0 flow is "RFQ Creation → **Admin Review** → Eligible Suppliers Receive RFQ" — this is a deliberate, task-directed change, not an invented feature.

| Status | Who Sets It | Entry Conditions | Allowed Next Statuses | Notifications | UI Behavior |
|---|---|---|---|---|---|
| DRAFT | Buyer (auto on create) | — | SUBMITTED | none | Editable; not visible to any supplier |
| SUBMITTED | Buyer ("Submit for Review") | All required fields valid | UNDER_REVIEW, DRAFT (buyer withdraws back to edit) | Admin queue entry created | Still editable by buyer; read-only to suppliers |
| UNDER_REVIEW | Admin (auto on opening review) | Status = SUBMITTED | PUBLISHED, REJECTED | none | Not editable by buyer while under review |
| REJECTED | Admin | Status = UNDER_REVIEW | SUBMITTED (buyer edits and resubmits) | Buyer notified with reason | Buyer can edit and resubmit |
| PUBLISHED | Admin (approve) | Status = UNDER_REVIEW | RECEIVING_OFFERS (auto on first offer), EXPIRED, CANCELLED | Eligible suppliers notified | Visible to all eligible suppliers in category; no longer editable by buyer |
| RECEIVING_OFFERS | System (auto on first offer received) | Status = PUBLISHED | AWARDED, EXPIRED, CANCELLED | Buyer notified per new offer | Buyer sees "Compare Offers" become active |
| EXPIRED | System (auto at offer_deadline_at with no acceptance) | Deadline passed, no offer accepted | — (terminal) | Buyer notified | Read-only |
| CANCELLED | Buyer (any time before AWARDED) | Status not AWARDED/CLOSED | — (terminal) | All offering suppliers notified | Read-only; existing offers auto-set to REJECTED |
| AWARDED | System (auto when buyer accepts an offer) | ≥1 valid offer, status = RECEIVING_OFFERS | CLOSED (auto when Order reaches COMPLETED) | Winning + losing suppliers notified | Read-only; Order record created |
| CLOSED | System (auto when linked Order reaches COMPLETED/CANCELLED) | Order terminal | — (terminal) | none | Read-only, appears in buyer's RFQ history |

**Edit rule:** editable only in DRAFT/SUBMITTED (Section 5.6). No edits are permitted after PUBLISHED in P0 — if the buyer needs to change a published RFQ, they cancel it and create a new one. This resolves the source's open question on post-publish edits by scoping it out of P0 rather than guessing at partial-edit rules.

**Deadlines:** offer_deadline_at is buyer-set at creation and validated to be a future timestamp; a scheduled job transitions PUBLISHED/RECEIVING_OFFERS RFQs with no accepted offer to EXPIRED once it passes.

### 8.2 RFQ Form Field Reference

| Field | Type | Required | Validation |
|---|---|---|---|
| category | select | Yes | must be an active category |
| title | text | Yes | ≤ 150 chars |
| quantity | number | Yes | > 0 |
| unit | text | Yes | — |
| dimensions | text | No | — |
| material | text | No | — |
| technical_specs | key/value list | No | — |
| printing_customization | textarea | No | — |
| delivery_deadline | date | Yes | future date |
| delivery_region | text | Yes | region-level, not a street address |
| quality_requirements | textarea | No | — |
| sample_required | toggle | Yes | default false |
| certifications_required | textarea | No | — |
| legal_compliance_requirements | textarea | No | — |
| attachments | file upload | No (Yes if printing_customization filled) | see Section 12 for type/size limits |
| offer_deadline_at | datetime | Yes | future, and ≤ delivery_deadline |

### 8.3 RFQ State Diagram

```
stateDiagram-v2
[*] --> DRAFT
DRAFT --> SUBMITTED: Buyer submits for review
SUBMITTED --> DRAFT: Buyer withdraws to edit
SUBMITTED --> UNDER_REVIEW: Admin opens review
UNDER_REVIEW --> REJECTED: Admin rejects
UNDER_REVIEW --> PUBLISHED: Admin approves
REJECTED --> SUBMITTED: Buyer edits and resubmits
PUBLISHED --> RECEIVING_OFFERS: First offer received
PUBLISHED --> EXPIRED: Deadline passed, no offers
PUBLISHED --> CANCELLED: Buyer cancels
RECEIVING_OFFERS --> AWARDED: Buyer accepts an offer
RECEIVING_OFFERS --> EXPIRED: Deadline passed, no acceptance
RECEIVING_OFFERS --> CANCELLED: Buyer cancels
AWARDED --> CLOSED: Linked order reaches COMPLETED/CANCELLED
EXPIRED --> [*]
CANCELLED --> [*]
CLOSED --> [*]
```

## SECTION 9 — OFFER IMPLEMENTATION

### 9.1 Offer Fields

Every offer uses the same schema regardless of category, so the buyer's comparison view is always apples-to-apples:

| Field | Required | Validation |
|---|---|---|
| unit_price | Yes | > 0 |
| moq | Yes | > 0 |
| production_lead_time_days | Yes | > 0, integer |
| delivery_time_estimate_days | Yes | > 0, integer |
| shipping_estimate_notes | No | free text (no live carrier rate in P0) |
| sample_availability | Yes | boolean |
| sample_terms | No (Yes if sample_availability = true) | — |
| payment_terms | No | free text |
| technical_specs_notes | No | free text |
| quality_notes | No | free text |
| attachments | No | see Section 12 |

### 9.2 Offer Statuses and Transitions

| Status | Meaning | Set By | Allowed Next |
|---|---|---|---|
| SUBMITTED | Initial submission | Supplier | UNDER_REVIEW, WITHDRAWN, EXPIRED |
| UNDER_REVIEW | Buyer is actively comparing (informational only — no separate action required to enter this state; treat as synonym of SUBMITTED for validation purposes) | System | ACCEPTED, REJECTED, WITHDRAWN, EXPIRED |
| ACCEPTED | Buyer selected this offer | Buyer (accept action) | — (terminal; triggers Order creation) |
| REJECTED | Not selected — either the RFQ was awarded to a different offer, or the RFQ was cancelled | System (auto) | — (terminal) |
| WITHDRAWN | Supplier withdrew before acceptance | Supplier | — (terminal) |
| EXPIRED | RFQ's offer deadline passed with this offer never accepted | System (auto) | — (terminal) |

**Edit/withdraw rule (resolves source ambiguity as an explicit MVP default, not an open decision — the task requires these features to exist):** a supplier may edit an offer in place (no duplicate row) any time its status is SUBMITTED/UNDER_REVIEW and now() < rfq.offer_deadline_at. Withdrawal is allowed any time before ACCEPTED. Editing after the deadline or after a decision returns 403.

### 9.3 Buyer Comparison View — Field Exposure

The buyer sees, per offer: supplier anonymized_id, completed_orders_count, average_rating, all fields in 9.1, and offer attachments. The buyer never sees: supplier legal name, phone, email, WhatsApp, social handles, or exact address (Section 11). No field is used to compute an auto-ranked "best offer" in P0 — sort/filter only, buyer always makes the final choice manually.

### 9.4 Offer Acceptance

Accepting an offer (Buyer action, Section 5.8) must, in a single transaction: set the accepted offer to ACCEPTED; set every other offer on that RFQ to REJECTED; set the RFQ to AWARDED; create the orders row with status OFFER_SELECTED; notify the winning and losing suppliers.

## SECTION 10 — ORDER IMPLEMENTATION

### 10.1 Order Statuses

The task's suggested status list is reconciled against the source's 12-stage lifecycle: the Hub-receipt and QC steps are kept as their own statuses because routing goods through a central hand-off point for inspection is a core business rule (goods do not ship supplier-to-buyer directly), even though no dedicated warehouse *system* is being built in P0 — Admin just logs these steps manually with a status change and an evidence upload.

OFFER_SELECTED → PENDING_PAYMENT → PAYMENT_CONFIRMED → PRODUCTION → [SAMPLE_REVIEW] → PRODUCTION_COMPLETED → RECEIVED_AT_HUB → QC_COMPLETED → READY_FOR_DELIVERY → IN_TRANSIT → DELIVERED → COMPLETED, with CANCELLED and DISPUTED as side paths.

| # | Status | Trigger | Actor | Required Conditions | Data Changes | Notification | Allowed Next |
|---|---|---|---|---|---|---|---|
| 1 | OFFER_SELECTED | Offer accepted | System (auto) | — | Order created | Buyer, winning + losing suppliers | PENDING_PAYMENT, CANCELLED |
| 2 | PENDING_PAYMENT | Auto, immediately after creation | System | — | — | Buyer reminded to pay (off-platform, OD-P-01) | PAYMENT_CONFIRMED, CANCELLED |
| 3 | PAYMENT_CONFIRMED | Admin manually confirms payment received | Admin | Payment verified outside the system (OD-P-01) | — | Buyer + Supplier notified | PRODUCTION, CANCELLED |
| 4 | PRODUCTION | Supplier marks production started | Supplier | Status = PAYMENT_CONFIRMED | — | Buyer notified | SAMPLE_REVIEW (if sample_required), PRODUCTION_COMPLETED, DISPUTED |
| 5 | SAMPLE_REVIEW | Supplier submits sample evidence | Supplier | sample_required = true, status = PRODUCTION | Sample evidence file attached | Buyer notified to review | PRODUCTION (approved, resumes), DISPUTED (rejected) |
| 6 | PRODUCTION_COMPLETED | Supplier marks production complete | Supplier | Status = PRODUCTION (sample approved if required) | — | Buyer notified | RECEIVED_AT_HUB, DISPUTED |
| 7 | RECEIVED_AT_HUB | Admin logs receipt | Admin | Status = PRODUCTION_COMPLETED; evidence photo + quantity note required | order_status_history evidence attached | Buyer + Supplier notified | QC_COMPLETED, DISPUTED (quantity mismatch) |
| 8 | QC_COMPLETED | Admin logs QC result = pass | Admin | Status = RECEIVED_AT_HUB; inspection note/evidence required | QC result recorded | Buyer notified; Supplier notified only if a prior fail was corrected | READY_FOR_DELIVERY, DISPUTED (fail) |
| 9 | READY_FOR_DELIVERY | Admin hands goods to courier | Admin | Status = QC_COMPLETED | Shipment reference (free text, no live tracking) | Buyer notified | IN_TRANSIT |
| 10 | IN_TRANSIT | Admin marks en route | Admin | Status = READY_FOR_DELIVERY | — | Buyer notified | DELIVERED |
| 11 | DELIVERED | Admin confirms delivery | Admin | Status = IN_TRANSIT | — | Buyer + Supplier notified; buyer prompted to rate | COMPLETED |
| 12 | COMPLETED | Buyer submits rating, or Admin closes after a timeout | Buyer or Admin | Status = DELIVERED | supplier_profiles.completed_orders_count +1, average_rating recomputed if rated | none | — (terminal); linked RFQ → CLOSED |
| — | CANCELLED | Admin or Buyer cancels | Admin (any stage before DELIVERED), Buyer (only before PAYMENT_CONFIRMED) | reason required | — | Buyer + Supplier notified | — (terminal); linked RFQ → CLOSED |
| — | DISPUTED | Sample rejection, QC fail, quantity mismatch, or manual open | Buyer, Supplier, or Admin | order not already terminal | Dispute record created | Buyer + Supplier notified | back to the pre-dispute status (reopen_production outcome), or CANCELLED (refund_manual/close_no_action outcome) — Admin decides manually (OD-P-04) |

**Invalid transitions:** any status change not listed as an "Allowed Next" value above must be rejected by the API with 409 Conflict. There is no forward-skipping (e.g. PAYMENT_CONFIRMED → PRODUCTION_COMPLETED directly).

**Required evidence:** RECEIVED_AT_HUB, QC_COMPLETED, and DELIVERED transitions require an evidence_file_id or a note on order_status_history; the API rejects the transition without one.

**Admin override:** Admin may force any transition (including backward, for correcting a mistake) via the Order Status Update screen, but every override still writes a full audit log entry with before/after state and a mandatory reason — it is a logged manual override, not a silent bypass.

### 10.2 Order State Diagram

```
stateDiagram-v2
[*] --> OFFER_SELECTED
OFFER_SELECTED --> PENDING_PAYMENT
PENDING_PAYMENT --> PAYMENT_CONFIRMED
PAYMENT_CONFIRMED --> PRODUCTION
PRODUCTION --> SAMPLE_REVIEW: sample_required = true
SAMPLE_REVIEW --> PRODUCTION: buyer approves sample
SAMPLE_REVIEW --> DISPUTED: buyer rejects sample
PRODUCTION --> PRODUCTION_COMPLETED: sample not required or approved
PRODUCTION_COMPLETED --> RECEIVED_AT_HUB
RECEIVED_AT_HUB --> QC_COMPLETED: pass
RECEIVED_AT_HUB --> DISPUTED: quantity mismatch
QC_COMPLETED --> READY_FOR_DELIVERY
QC_COMPLETED --> DISPUTED: fail
READY_FOR_DELIVERY --> IN_TRANSIT
IN_TRANSIT --> DELIVERED
DELIVERED --> COMPLETED
COMPLETED --> [*]
DISPUTED --> PRODUCTION: reopen_production
DISPUTED --> CANCELLED: refund_manual / close_no_action
OFFER_SELECTED --> CANCELLED
PENDING_PAYMENT --> CANCELLED
PAYMENT_CONFIRMED --> CANCELLED
CANCELLED --> [*]
```

## SECTION 11 — IDENTITY AND CONTACT PROTECTION

P0 implements **basic** protection only — no OCR, no AI moderation (P2, Section 20).

**The system must, everywhere a buyer and supplier can see each other's data (RFQ views, offer views, order views, messages, files):**

- Never display phone number, email address, WhatsApp handle, or any social media handle of the counterpart.
- Never display the counterpart's exact/detailed address — only general_region.
- Never display the counterpart's legal_name — only anonymized_id/display_name.
- Enforce this at the API layer (the serializer for any buyer-facing supplier object, and vice versa, must not include the restricted fields at all — not merely hide them in the UI).

**Exception:** an organization's logo_file_id may become visible to the *awarded* supplier once an Order exists, if it is needed to execute printing/production (Section 12 file permission rule). This is the only identity exception, and it never includes contact information — a logo image is not treated as contact information even if it contains a company name.

**Message/text scanning (P0, basic — regex-based):** every message body is scanned before delivery for phone-number patterns, email-address patterns, and URLs.

- Match found → the message is still saved, but the matched text is replaced with [redacted] in masked_content (which is what the counterpart sees); the original content is retained for Admin review; messages.flagged = true; a message_flags row is created with status = pending_review.
- No match → delivered normally, masked_content = content.
- Admin reviews the flag queue (Section 7.12) and applies the escalation ladder: Warning → Strike → Suspension → Ban, based on severity/repetition — a manual admin decision each time in P0, not an automated threshold.
- Every flag and every escalation action is written to audit_logs.

**Explicit non-goals for P0:** OCR scanning of uploaded images/files for printed contact information; detecting obfuscated attempts (spaced-out digits, homoglyphs); any automated account action without an Admin reviewing the flag first. These are P1/P2 (Section 20).

### 11.1 Data Visibility Matrix (condensed)

| Data Element | Visible to Counterpart Buyer/Supplier? | Visible to Admin? |
|---|---|---|
| Legal company name | No | Yes |
| Phone / email / WhatsApp / social handles | No | Yes (account/ops use only) |
| Exact address | No | Yes (for Hub/shipping/logging use only) |
| General region | Yes | Yes |
| Anonymized ID / performance stats | Yes | Yes |
| Company logo (on artwork, only once an order exists) | Yes, awarded supplier only | Yes |

## SECTION 12 — FILE SYSTEM

### Upload

- Allowed types: image/png, image/jpeg, application/pdf. (Design/artwork files and certificates only — no arbitrary file types in P0.)
- Max size: 10 MB per file (configurable constant).
- Every upload creates a files row and is scanned for allowed MIME type and size before storage; rejects otherwise with 422.

### Storage

- Private object storage bucket. No file is ever publicly readable by URL — every read goes through a permission check and a short-lived signed URL (5 minute expiry).

### Access permissions

- RFQ attachments flagged contains_identity_risk = true (Section 3, rfq_attachments): while the RFQ is PUBLISHED/RECEIVING_OFFERS, eligible suppliers see only a **watermarked preview** ("Wardly Confidential" overlay, generated once at upload time using a simple static image/PDF overlay — no OCR involved). The original file is not exposed at this stage to any supplier.
- Once an Order exists for that RFQ, the **awarded supplier only** gains access to the original (non-watermarked) file for production purposes (Section 11 exception). Every other supplier retains preview-only access, then loses access entirely once the RFQ is no longer PUBLISHED/RECEIVING_OFFERS.
- Offer attachments (certificates/photos) are visible to the buyer that owns the RFQ, and to Admin.
- Supplier verification documents are visible only to Admin and the owning supplier.

### Download permissions

- Every file read (preview or original) is served via a signed URL generated on request; every generation is logged (audit_logs, action = file.viewed / file.downloaded, entity = file id, actor = requesting user).

### Deletion rules

- Soft delete only (files.deleted_at). Buyer/Supplier may delete their own uploaded file only while the parent RFQ/offer is still editable (DRAFT/SUBMITTED, or SUBMITTED/UNDER_REVIEW for offers). Admin may soft-delete any file with a reason (audit logged). Files already referenced by an awarded Order are never deletable through the UI (compliance/evidence trail).

### File audit logging

- Log on upload, on every preview/original view, on download, and on delete — actor, file id, action, timestamp (via audit_logs, reusing the generic schema rather than a separate table).

## SECTION 13 — MESSAGING

Messaging **is** in P0 (required to support "Basic contact information blocking in messages").

- A conversations row is created automatically the first time a buyer or supplier sends a message tied to a specific RFQ (pre-award) or Order (post-award) — one conversation per RFQ-supplier pair, and one per Order.
- Buyer and Supplier can each send messages in their own conversation; neither can see another buyer's or supplier's conversation.
- Admin has read access to every conversation (Section 7.12 surfaces only the flagged ones by default, but the admin order/RFQ detail screens can link into the full thread for context).
- Every message passes through the contact-detection scan (Section 11) before being shown to the counterpart.
- Flagged messages appear in the Admin Message Flag Review queue (Section 7.12).
- New message → in-app notification to the recipient (Section 14).

## SECTION 14 — NOTIFICATIONS

Event-based, in-app for all events, email additionally for the ones marked "High" priority below. SMS/WhatsApp are explicitly not built in P0 (future extensibility only, Section 20).

| Event | Recipient | Channel | Priority | Content Type |
|---|---|---|---|---|
| Account created | New user | In-app + email | Normal | Welcome |
| Supplier approved | Supplier | In-app + email | High | Status change |
| Supplier rejected | Supplier | In-app + email | High | Status change + reason |
| RFQ submitted (for review) | Admin (queue, no per-user notification needed) | In-app | Normal | Queue entry |
| RFQ approved | Buyer | In-app + email | Normal | Status change |
| RFQ rejected | Buyer | In-app + email | High | Status change + reason |
| New RFQ available | Eligible suppliers | In-app + email | Normal | New opportunity |
| Offer submitted | Buyer | In-app + email | Normal | New offer alert |
| Offer accepted | Winning supplier | In-app + email | High | Decision |
| Offer rejected | Losing suppliers | In-app | Normal | Decision |
| Order created | Buyer + Supplier | In-app + email | High | Confirmation |
| Order status changed | Buyer and/or Supplier per Section 10.1 | In-app (+ email for PAYMENT_CONFIRMED, DELIVERED) | Varies | Status update |
| Sample ready for review | Buyer | In-app + email | High | Action required |
| Sample decision | Supplier | In-app + email | High | Decision |
| Dispute opened | Buyer + Supplier | In-app + email | High | Case update |
| Dispute resolved | Buyer + Supplier | In-app + email | High | Case update |
| Message flagged (warning/strike/suspension/ban) | Affected user | In-app + email | High | Policy enforcement |
| New message received | Recipient | In-app | Normal | Message alert |

**Read/unread state:** notifications.read boolean, defaults false, set true when the user opens the linked screen or explicitly marks it read.

## SECTION 15 — ADMIN MANUAL OPERATIONS

This is the operational backbone of the MVP — the system is built to be driven by hand.

Admin must be able to:

- **Manually approve/reject suppliers** — Section 7.3.
- **Manually distribute RFQs** — default is "all approved suppliers in category"; Admin can override the list per RFQ — Section 7.7.
- **Manually update order statuses** — including recording payment confirmation (OD-P-01: no gateway exists, Admin verifies off-platform and flips the status), Hub receipt, QC result, courier hand-off, and delivery, each with required evidence — Section 7.10/10.1.
- **Manually resolve disputes** — free-text investigation notes + one of three outcomes (OD-P-04) — Section 7.13.
- **Add internal notes** — admin_notes field exists on rfqs, orders, and is addressable per user via an audit-logged action; never shown to buyer/supplier.
- **Suspend/ban users** — Section 7.2, reason required.
- **Correct operational data with audit logging** — any manual admin edit to an order/RFQ field (e.g. fixing a wrong quantity typed by mistake) must write a before/after audit_logs entry; there is no "quiet edit" path in the API for admin-authored changes.

**Rule with no exception:** every action in this section results in at least one audit_logs row (Section 19). If an admin screen has a button that changes state, that button's handler must log.

## SECTION 16 — API SPECIFICATION

REST, JSON. All endpoints except /auth/register and /auth/login require a valid bearer token. Authorization follows Section 2's matrix. Standard error envelope: `{ "error": { "code": string, "message": string } }`.

### /auth

| Method | Endpoint | Auth | Role | Body | Validation | Response | Errors |
|---|---|---|---|---|---|---|---|
| POST | /auth/register | None | — | email, password, role (buyer\|supplier), org fields (Section 4) | Section 17 | 201, user + org | 422 validation, 409 duplicate email |
| POST | /auth/login | None | — | email, password | required | 200, access+refresh token | 401 invalid credentials, 403 suspended/banned, 429 lockout |
| POST | /auth/logout | Required | any | — | — | 204 | 401 |
| POST | /auth/refresh | Required (refresh token) | any | refresh_token | valid, not revoked | 200, new access token | 401 |
| POST | /auth/password-reset-request | None | — | email | valid format | 200 (always, no email enumeration) | — |
| POST | /auth/password-reset | None | — | token, new_password | token valid/not expired, password rules | 200 | 400 invalid/expired token |
| POST | /auth/verify-email | None | — | token | token valid | 200 | 400 invalid/expired token |

### /users

| Method | Endpoint | Auth | Role | Notes |
|---|---|---|---|---|
| GET | /users/me | Required | any | own profile |
| GET | /admin/users | Required | admin | list, filter by role/status/search |
| GET | /admin/users/{id} | Required | admin | full detail incl. real identity |
| PATCH | /admin/users/{id}/suspend | Required | admin | body: reason (required) |
| PATCH | /admin/users/{id}/reactivate | Required | admin | — |
| PATCH | /admin/users/{id}/ban | Required | admin | body: reason (required) |

### /organizations

| Method | Endpoint | Auth | Role | Notes |
|---|---|---|---|---|
| GET | /organizations/me | Required | buyer, supplier | own org |
| PATCH | /organizations/me | Required | buyer, supplier | update profile fields |
| GET | /organizations/{id} | Required | counterpart role, admin | masked per Section 11 unless admin |

### /categories

| Method | Endpoint | Auth | Role | Notes |
|---|---|---|---|---|
| GET | /categories | Public | — | active + coming_soon |
| POST | /admin/categories | Required | admin | create |
| PATCH | /admin/categories/{id}/activate | Required | admin | — |
| PATCH | /admin/categories/{id}/deactivate | Required | admin | warns if open RFQs exist (UI-level; API still allows) |

### /suppliers

| Method | Endpoint | Auth | Role | Notes |
|---|---|---|---|---|
| POST | /suppliers/verification-documents | Required | supplier | multipart upload, creates supplier_verifications row |
| GET | /suppliers/{id} | Required | counterpart role, admin | returns anonymized_id/score fields only unless admin |
| POST | /suppliers/categories | Required | supplier | apply for category |
| GET | /admin/suppliers/verification | Required | admin | pending queue |
| PATCH | /admin/suppliers/{id}/verification | Required | admin | body: status(verified\|rejected), reason |
| PATCH | /admin/suppliers/{id}/categories/{catId} | Required | admin | body: approved (bool) |

### /rfqs

| Method | Endpoint | Auth | Role | Body/Params | Validation | Response | Errors |
|---|---|---|---|---|---|---|---|
| POST | /rfqs | Required | buyer | Section 8.2 fields | required fields for DRAFT save = title only; full set required to submit | 201 DRAFT | 422 |
| PATCH | /rfqs/{id} | Required | buyer (own) | any Section 8.2 field | status must be DRAFT/SUBMITTED | 200 | 403 wrong status/owner, 422 |
| PATCH | /rfqs/{id}/submit | Required | buyer (own) | — | all required fields present, deadlines valid | 200, status=SUBMITTED | 422 |
| PATCH | /rfqs/{id}/cancel | Required | buyer (own) | reason | status not AWARDED/CLOSED | 200, status=CANCELLED | 409 |
| GET | /rfqs/{id} | Required | buyer(own), supplier(if eligible/published), admin | — | — | 200, masked per role | 403, 404 |
| GET | /rfqs | Required | buyer(own list), supplier(eligible feed) | filters: category, status | — | 200 paginated | — |
| GET | /rfqs/{id}/history | Required | buyer(own), admin | — | — | 200, audit trail | 403 |
| GET | /admin/rfqs/review | Required | admin | filter: category, search | — | 200 paginated | — |
| PATCH | /admin/rfqs/{id}/approve | Required | admin | — | status=UNDER_REVIEW | 200, status=PUBLISHED | 409 |
| PATCH | /admin/rfqs/{id}/reject | Required | admin | reason (required) | status=UNDER_REVIEW | 200, status=REJECTED | 409, 422 |
| PATCH | /admin/rfqs/{id}/distribution | Required | admin | supplier_id list | — | 200 | — |

### /offers

| Method | Endpoint | Auth | Role | Body/Params | Validation | Response | Errors |
|---|---|---|---|---|---|---|---|
| POST | /rfqs/{id}/offers | Required | supplier | Section 9.1 fields | RFQ published/receiving_offers, before deadline, supplier approved for category, no existing active offer | 201 | 403, 409 duplicate, 422 |
| PATCH | /offers/{id} | Required | supplier (own) | Section 9.1 fields | status=SUBMITTED/UNDER_REVIEW, before deadline | 200 | 403, 422 |
| PATCH | /offers/{id}/withdraw | Required | supplier (own) | — | not yet ACCEPTED | 200, status=WITHDRAWN | 409 |
| GET | /rfqs/{id}/offers | Required | buyer(own RFQ) | — | — | 200, comparison payload (masked) | 403 |
| PATCH | /offers/{id}/accept | Required | buyer (own RFQ) | — | offer status=SUBMITTED/UNDER_REVIEW | 200, creates Order | 409 |
| GET | /admin/offers | Required | admin | filters | — | 200 paginated | — |
| PATCH | /admin/offers/{id}/flag | Required | admin | note | — | 200 | — |

### /orders

| Method | Endpoint | Auth | Role | Body/Params | Validation | Response | Errors |
|---|---|---|---|---|---|---|---|
| GET | /orders/{id} | Required | buyer(own), supplier(own), admin | — | — | 200, incl. status history | 403 |
| GET | /orders | Required | buyer(own), supplier(own), admin(all) | filters: status | — | 200 paginated | — |
| PATCH | /orders/{id}/mark-production-started | Required | supplier (own) | — | status=PAYMENT_CONFIRMED | 200 | 409 |
| POST | /orders/{id}/samples | Required | supplier (own) | evidence file | status=PRODUCTION, sample_required=true | 200, status=SAMPLE_REVIEW | 409 |
| PATCH | /orders/{id}/samples/decision | Required | buyer (own) | decision(approve\|reject) | status=SAMPLE_REVIEW | 200 | 409 |
| PATCH | /orders/{id}/mark-production-completed | Required | supplier (own) | — | status=PRODUCTION (sample ok) | 200 | 409 |
| POST | /orders/{id}/reorder | Required | buyer (own) | — | order status=COMPLETED | 201, new RFQ (DRAFT) | 403 |
| PATCH | /admin/orders/{id}/status | Required | admin | to_status, evidence_file_id (conditionally required), note | per Section 10.1 allowed-next table | 200 | 409 invalid transition, 422 missing evidence |
| PATCH | /admin/orders/{id}/confirm-payment | Required | admin | — | status=PENDING_PAYMENT | 200, status=PAYMENT_CONFIRMED | 409 |

### /files

| Method | Endpoint | Auth | Role | Notes |
|---|---|---|---|---|
| POST | /files | Required | buyer, supplier | multipart upload; Section 12 type/size checks |
| GET | /files/{id}/preview | Required | counterpart role, owner, admin | watermarked, signed URL, 5-min expiry |
| GET | /files/{id}/original | Required | owner, awarded supplier (post-order), admin | gated per Section 12; logs access |
| DELETE | /files/{id} | Required | owner (pre-award), admin | soft delete only |

### /messages

| Method | Endpoint | Auth | Role | Notes |
|---|---|---|---|---|
| GET | /conversations | Required | buyer, supplier, admin | own conversations (admin: all) |
| GET | /conversations/{id}/messages | Required | participant, admin | paginated |
| POST | /conversations/{id}/messages | Required | participant | body: content; passes contact-detection scan (Section 11) before delivery |
| GET | /admin/messages/flags | Required | admin | filter: status, pattern_type |
| PATCH | /admin/messages/flags/{id} | Required | admin | body: action(dismiss\|warning\|strike\|suspension\|ban) |

### /notifications

| Method | Endpoint | Auth | Role | Notes |
|---|---|---|---|---|
| GET | /notifications | Required | any | own, paginated |
| PATCH | /notifications/{id}/read | Required | any (own) | — |
| PATCH | /notifications/read-all | Required | any | — |

### /admin

| Method | Endpoint | Auth | Role | Notes |
|---|---|---|---|---|
| GET | /admin/dashboard | Required | admin | summary counts |
| GET | /admin/audit-logs | Required | admin | filter: actor, entity_type, date range |
| GET | /admin/disputes | Required | admin | filter: status |
| GET | /admin/disputes/{id} | Required | admin | — |
| PATCH | /admin/disputes/{id}/resolve | Required | admin | body: outcome(reopen_production\|refund_manual\|close_no_action), notes |
| POST | /admin/disputes | Required | buyer, supplier, admin | body: order_id, category, description |

## SECTION 17 — VALIDATION RULES

| Area | Rule |
|---|---|
| Registration email | valid RFC 5322 format, unique across users |
| Registration password | ≥ 8 characters, at least 1 letter and 1 number |
| Company legal name | required, ≤ 200 chars |
| RFQ quantity | required, > 0, numeric |
| RFQ delivery_deadline | required, must be a future date |
| RFQ offer_deadline_at | required, future, and ≤ delivery_deadline |
| RFQ title | required, ≤ 150 chars |
| RFQ attachments | required if printing_customization is non-empty |
| Offer unit_price | required, > 0 |
| Offer moq | required, > 0 |
| Offer production_lead_time_days | required, > 0, integer |
| Offer delivery_time_estimate_days | required, > 0, integer |
| Offer uniqueness | one active (non-withdrawn/expired) offer per supplier per RFQ |
| File type | one of image/png, image/jpeg, application/pdf |
| File size | ≤ 10 MB |
| Message content | required, ≤ 2000 chars |
| Rating score | required, integer 1–5 |
| Rating uniqueness | one rating per order |
| Order status transition | must appear in the allowed-next list (Section 10.1); evidence file required for RECEIVED_AT_HUB / QC_COMPLETED / DELIVERED |
| Suspension/ban reason | required, ≤ 500 chars |
| RFQ/offer reject reason | required, ≤ 500 chars |

## SECTION 18 — ERROR HANDLING

| Scenario | HTTP Status | Behavior |
|---|---|---|
| Unauthenticated request | 401 | Redirect to login; do not leak whether the resource exists |
| Authenticated but wrong role/ownership | 403 | Generic "You don't have access to this" |
| Resource not found | 404 | Generic "Not found" (never distinguish "doesn't exist" from "not yours" for cross-tenant resources — return 404 for both to avoid leaking existence) |
| Duplicate submission (e.g. second offer on same RFQ, duplicate email) | 409 | Explicit conflict message naming the conflicting resource |
| Expired RFQ (offer attempted after deadline) | 403 | "This RFQ is no longer accepting offers." |
| Late offer edit/withdrawal attempt | 403 | "This offer can no longer be modified." |
| Invalid order/RFQ status transition | 409 | "This action is not available for the current status." |
| File upload failure (type/size) | 422 | Field-level error naming the allowed types/size |
| File upload failure (storage error) | 502 | "Upload failed, please try again." — retry-safe, no partial file record persisted |
| Network/API failure (client) | — | Client shows a retry affordance; no silent failure |
| Validation failure | 422 | Field-level error array |

## SECTION 19 — AUDIT LOGGING

Minimum logged actions: login/logout and failed-login lockouts; supplier approval/rejection; RFQ approval/rejection; RFQ distribution changes; offer creation/edit/withdrawal/acceptance; order status changes (including admin overrides); dispute open/resolve; message flag creation and every escalation action; file upload/view/download/delete; user suspension/ban/reactivation.

**Schema (audit_logs, see Section 3):** actor_id (null = system), action (dot-namespaced string, e.g. order.status_changed, rfq.rejected, message.flagged), entity_type, entity_id, before_state (JSON snapshot of changed fields only), after_state (JSON snapshot of changed fields only), created_at. Logs are append-only — no update/delete endpoint exists for audit_logs at any role, including admin.

## SECTION 20 — NOT PART OF MVP

### P1 — build after validation

- **Automated Supplier Score** — multi-factor weighted scoring (completed orders, rating, on-time delivery, spec compliance, cancellation rate, response speed, dispute rate, sample quality, QC performance) with tiers (New/Bronze/Silver/Gold/Platinum) and configurable, versioned weights. P0 ships only raw completed_orders_count + average_rating.
- **Buyer Reputation** — trust indicator built from payment timeliness, cancellation rate, dispute history, sample-approval delay, general behavior; shown to suppliers without revealing buyer identity.
- **Better analytics/KPI dashboard** — network growth, activity, financial performance, retention, quality/compliance, commercial efficiency, category-expansion metrics.
- **Payment integration** — real licensed-provider integration, webhook-driven PAYMENT_CONFIRMED, refunds via the provider, commission/fee calculation and charging (resolves OD-P-01 and OD-P-06).
- **Shipping integration** — live carrier rate/tracking API, computed logistics margin, replacing the free-text shipping notes used in P0.

### P2 — later

- **Advanced OCR-based contact detection** inside uploaded images/files.
- **AI-assisted / advanced automated anti-circumvention** beyond basic text-pattern regex (detecting obfuscated attempts, chat pattern modeling).
- **Advanced fraud detection** (behavioral signal modeling beyond manual review).
- **Automated QC workflows** (structured category-specific checklist scoring beyond a free-text pass/fail/conditional note).
- **Advanced warehouse/Hub operations** (a real WMS: bin/location tracking, capacity management, category-specific storage handling).
- **Multi-category expansion tooling** beyond the already-extensible category table (demand-driven category sequencing tools, category-specific onboarding flows).
- **Native mobile applications.**

## SECTION 21 — IMPLEMENTATION BACKLOG

**EPIC: Authentication & Access Control**
- FEATURE: Registration, login, sessions, RBAC.
  - STORY: As a buyer/supplier, I can register, verify my email, and log in.
    - TASKS: registration endpoints + validation; email verification flow; login/logout/refresh; password reset flow; role-based route guards (API + frontend); account lockout after failed attempts.
  - PRIORITY: P0

**EPIC: Company Onboarding**
- FEATURE: Company profile, supplier verification, category application.
  - STORY: As a supplier, I submit my documents and apply for categories so I can see RFQs.
    - TASKS: organization CRUD; file upload for verification docs; supplier_verifications workflow + admin review screen; supplier_categories apply/approve flow.
  - PRIORITY: P0

**EPIC: RFQ Lifecycle**
- FEATURE: RFQ builder, admin review, distribution.
  - STORY: As a buyer, I create an RFQ and submit it for review so eligible suppliers can see it.
    - TASKS: RFQ CRUD + multi-step form; RFQ state machine + scheduled expiry job; admin review queue + approve/reject; distribution list generation + override screen; RFQ attachments with watermark generation.
  - PRIORITY: P0

**EPIC: Offer Management**
- FEATURE: Offer submission, edit, withdrawal, comparison, acceptance.
  - STORY: As a supplier, I submit an offer; as a buyer, I compare and accept one.
    - TASKS: offer CRUD + state machine; comparison view API (masked fields); accept-offer transaction (reject others, create order, notify); offer attachments.
  - PRIORITY: P0

**EPIC: Order Management**
- FEATURE: Order lifecycle, manual admin operations, sample workflow, disputes.
  - TASKS: order state machine + allowed-transition guard; order status history + evidence upload; sample submit/approve/reject; admin order status update screen; dispute open/resolve flow; reorder endpoint.
  - PRIORITY: P0

**EPIC: Identity & File Protection**
- FEATURE: Masking, watermarking, gated file access.
  - TASKS: response serializer masking layer for all buyer/supplier-facing endpoints; file upload pipeline + watermark generation; preview vs. original access-control logic; signed URL generation + expiry.
  - PRIORITY: P0

**EPIC: Messaging & Anti-Circumvention**
- FEATURE: Conversations, regex-based contact detection, escalation.
  - TASKS: conversation/message CRUD; regex detection pipeline (phone/email/URL); masked_content generation; message_flags + admin review queue; escalation actions (warning/strike/suspension/ban) + notifications.
  - PRIORITY: P0

**EPIC: Notifications**
- FEATURE: Event-driven in-app + email notifications.
  - TASKS: notification table + read state; event triggers wired into RFQ/offer/order/message services; email delivery integration (transactional email provider).
  - PRIORITY: P0

**EPIC: Ratings & Reorder**
- FEATURE: Post-delivery rating, one-click reorder.
  - TASKS: rating CRUD + uniqueness constraint; average_rating/completed_orders_count recompute on new rating/order completion; reorder endpoint pre-filling a new RFQ from a prior order.
  - PRIORITY: P0

**EPIC: Admin Dashboard**
- FEATURE: All admin queues and manual-operations screens.
  - TASKS: dashboard summary counts; user management + suspend/ban; supplier verification queue; category management; RFQ review + distribution; offer monitoring; order management; message flag review; dispute management; audit log viewer + export.
  - PRIORITY: P0

**EPIC: Audit Logging**
- FEATURE: Append-only audit trail across all state-changing actions.
  - TASKS: audit_logs table + write helper used by every service; wire into every P0 action listed in Section 19.
  - PRIORITY: P0

**EPIC: Scoring & Reputation (deferred)**
- FEATURE: Automated Wardly Score, Buyer Reputation.
  - PRIORITY: P1

**EPIC: Payments & Shipping Integration (deferred)**
- FEATURE: Licensed payment provider, live shipping rates/tracking.
  - PRIORITY: P1 (blocked on OD-P-01/OD-P-06)

**EPIC: Advanced Protection (deferred)**
- FEATURE: OCR, AI-assisted anti-circumvention, advanced fraud detection.
  - PRIORITY: P2

## SECTION 22 — DEFINITION OF DONE

| Module | Functional Reqs Met | Validation Implemented | Permissions Tested | Error Cases Handled | Audit Logging | Responsive UI | No Critical Bugs |
|---|---|---|---|---|---|---|---|
| Auth & RBAC | Register/login/reset/verify work end-to-end for both roles | Section 17 rules enforced server-side | Role guard tested on every route | 401/403/409/422 per Section 18 | Login, lockout, suspension logged | ✓ | ✓ |
| Company Onboarding | Verification + category flows complete | Doc upload type/size enforced | Admin-only approve/reject verified | Duplicate category application blocked | Approval/rejection logged | ✓ | ✓ |
| RFQ | Full state machine implemented, all screens built | Section 8.2/17 rules enforced | Buyer-own vs. supplier-eligible vs. admin-all enforced at API | Invalid transitions rejected 409 | All transitions + edits logged | ✓ | ✓ |
| Offers | Submit/edit/withdraw/accept implemented | Section 9/17 rules enforced | Supplier-own edit, buyer-own accept enforced | Late/duplicate offer rejected | All lifecycle events logged | ✓ | ✓ |
| Orders | Full state machine + manual admin controls | Evidence-required transitions enforced | Admin-only status change, supplier/buyer scoped actions enforced | Invalid transitions rejected 409 | Every transition + override logged | ✓ | ✓ |
| Identity/File Protection | Masking verified on every cross-role endpoint; watermark generated on upload | File type/size enforced | Original-file access gated to awarded supplier only | Unauthorized file access returns 403/404 | Every file view/download logged | ✓ | ✓ |
| Messaging | Conversations + scanning + flag queue implemented | Message length enforced | Participant-only read/write enforced | Flagged message still delivered (redacted) not silently dropped | Every flag + escalation logged | ✓ | ✓ |
| Notifications | All Section 14 events wired | — | Users only see own notifications | Failed email delivery retried/logged | — | ✓ | ✓ |
| Ratings/Reorder | Rating + reorder implemented | One rating per order enforced | Buyer-own rating enforced | Duplicate rating rejected 409 | Rating creation logged | ✓ | ✓ |
| Admin Dashboard | All queues/screens functional | — | Admin-only enforced globally | — | Every admin action logged | ✓ | ✓ |
| Audit Log | Append-only, covers Section 19 list | — | Admin-only read | — | Self-referential — the log itself is the check | ✓ | ✓ |

## DEVELOPER STARTING POINT

**1. What to build first:** Database schema (Section 3) + authentication/RBAC (Section 4) + the identity-masking serializer layer (Section 11). Everything else depends on these three being correct, and masking is far cheaper to build into every serializer from day one than to retrofit later.

**2. Recommended implementation order**

1. Schema + migrations (Section 3).
2. Auth, sessions, RBAC guards (Section 4).
3. Organizations, buyer/supplier profiles, category management (Sections 2, 6.4, 7.4).
4. Supplier verification workflow (Sections 6.3, 7.3) — needed before any supplier can see an RFQ.
5. File upload + watermark + gated access (Section 12) — needed before RFQ attachments work.
6. RFQ builder + admin review + distribution (Sections 5.4–5.7, 7.6–7.7, 8).
7. Offer submission + comparison + acceptance (Sections 6.7–6.9, 5.8, 9).
8. Order creation + full manual status machine + admin order screen (Sections 5.9–5.10, 6.11, 7.10, 10).
9. Messaging + contact-detection + flag queue (Sections 13, 7.12, 11).
10. Notifications (Section 14) — wire in as each upstream feature lands, not as one big-bang integration.
11. Ratings + reorder (Sections 5.11–5.12, 6.12).
12. Audit log viewer (Section 7.14) — the logging calls themselves should already exist inline in every prior step; this step is just the read UI.

**3. P0 milestones**

- **M1:** A buyer can register, create an RFQ, and have it approved by Admin.
- **M2:** A verified supplier can see that RFQ and submit an offer; the buyer can compare and accept it, creating an Order.
- **M3:** Admin can manually walk that Order through every status to DELIVERED, and the buyer can rate it and reorder.
- **M4:** Identity masking, file gating, and message contact-detection are verified end-to-end (no leak of restricted fields anywhere in M1–M3's surfaces).
- **M5:** Admin dashboard + audit log give full visibility/override over everything built in M1–M4.

**4. Dependencies**

- Supplier verification must exist before RFQ distribution can be tested meaningfully (no eligible suppliers otherwise).
- File upload/watermarking must exist before the RFQ attachments field can be exercised.
- The order state machine and its evidence-upload rule depend on file upload existing first.
- Notifications depend on every upstream event source (RFQ/offer/order/message services) already emitting the relevant event.

**5. Explicitly not required for the first release:** Payment gateway integration, live shipping/tracking integration, automated Supplier Score/Buyer Reputation, OCR/AI-based contact detection, a warehouse management system, native mobile apps, and multi-category rollout tooling beyond an extensible categories table. See Section 20 for the full P1/P2 list and the Open Decisions Register at the top of this document for the items that are legally/commercially unresolved rather than simply deferred.

*End of document.*
