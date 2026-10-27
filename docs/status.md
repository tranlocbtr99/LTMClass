# Implementation status

Updated: 2026-10-27. Initial usable teacher-workspace foundation, not the complete product.

## Implemented
- Same-origin Worker API and responsive Vietnamese interface.
- Teacher registration, salted PBKDF2 password storage, expiring HttpOnly sessions, authentication throttling.
- Teacher workspace membership checks on every tenant request; owner-only writes.
- Create/archive classes and students, enrollment, dated lessons and attendance.
- Invoices, partial payments, idempotent payment requests and atomic overpayment guard.
- Audit trail; archiving preserves history; composite foreign keys block cross-tenant links.
- Automated security/schema tests and validation/release workflows.

## Deployment
The replacement account API token verified successfully. D1 provisioned and migration 0001 applied. Initial teacher workspace deployed at https://ltmclass.tranlocbtr99.workers.dev on 2026-10-27. Version: 2cb72a22-9441-485c-aaad-63bc5ef8dfab. All 13 local security, SQL and workflow tests pass. Browser interaction QA remains incomplete because local Wrangler preview fails with uv_interface_addresses in this environment. GitHub production deployment still requires repository environment secrets; no token is committed.

## Remaining product scope
- Invitations and class-scoped assistant grants; student and verified guardian portals.
- Verified email, password recovery, account export/deletion and retention policy.
- R2 materials, assignments, submissions and grade publishing.
- Question bank, exams, timed attempts, autosave/recovery and grading snapshots.
- Notification outbox, deduplication and delivery channels.
- Recurring schedules, enrollment removal and richer editing/reporting.
- Pagination beyond the initial 500 recent lessons/invoices; accurate global reporting at larger scale.
- Production integration/browser/load tests and backup/restore drill.

Do not onboard real students until release requirements are complete.
