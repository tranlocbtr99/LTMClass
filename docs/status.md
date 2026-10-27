# LTMClass status — 2026-10-27

## Deployed application
https://ltmclass.tranlocbtr99.workers.dev

Implemented teacher, student, guardian and class-scoped assistant workflows. Account signup currently creates a personal teacher workspace; linked student and guardian views are available from its header. Teachers issue single-use, 24-hour invitation codes. Guardian relationship verification is performed by the teacher before issuing a code; this is not automated identity verification.

## Features
- Classes and student creation/editing/archiving, enrollments and withdrawal without deleting history.
- Weekly lesson generation (1–24 weeks), attendance, class-scoped assistant access and revocation.
- Assignments, one submission per student, deadlines, 0–10 grading and feedback.
- Four-option question bank, exam question snapshots, publication controls, one attempt per student.
- Server deadline enforcement, change-based answer autosave, attempt recovery and idempotent final submission.
- Automatic grading at expiry via scheduled job every five minutes and on subsequent attempt access.
- Guardian attendance, homework/exam grades and tuition views; explicit revocation.
- In-app notifications for homework, grades, attendance and receipts; event deduplication.
- Invoices, partial payments, overpayment prevention and idempotency keys.
- Accurate overall totals and reports, tenant JSON export and audit history.
- Password change with current-password verification and revocation of all sessions.
- PWA shell; offline cache excludes all API responses and user records.
- Private R2 upload/download implementation (PDF/DOCX/PNG/JPG/TXT; 5 MB), disabled until the account activates R2.

## Validation
19 automated checks: 13 Node security/workflow checks, 5 schema checks and one full SQLite backup/restore exercise. Integration checks cover ownership isolation, cross-class assistant denial, guardian revocation, assignment grading, exam recovery/deadlines/snapshots, receipt deduplication, notification deduplication and scheduled expiry. These are local tests using real SQLite with a D1 adapter, not a claim of production load capacity.

Cloudflare accepted all five migrations. Public authentication shell was inspected in Chrome. Signed-in browser workflows and mobile/PWA install checks remain incomplete. Local Wrangler preview is blocked by uv_interface_addresses in this environment.

## External blockers and remaining release work
- Cloudflare R2 API returns 403 / 10042: "Please enable R2 through the Cloudflare Dashboard." Account owner must activate R2; then run deployment helper with --with-r2. No upload feature is presented as ready before binding exists.
- No email sender/domain configured: email verification, password-reset email and external notifications are not implemented. Existing email addresses are not verified.
- GitHub production environment secrets are not configured; existing validation and manual release workflows are committed. Current publication is performed directly with the session-supplied Cloudflare token, which is never committed.
- Retention/deletion and consent workflows for actual child data need policy decisions and implementation before real student onboarding.
- Global lesson/invoice reports use full aggregates, but main lists show at most 500 recent records; large-dataset pagination remains to implement.
- Production load test and remote D1 disaster-recovery drill remain; local SQLite restore test does not replace these.
- Student/guardian sign-up flow still uses personal workspace creation, to be streamlined.

Full original project scope is not yet complete. No production records were fabricated for validation.
