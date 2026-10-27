# LTMClass status — 2026-10-27

## Deployed application
https://ltmclass.tranlocbtr99.workers.dev

Implemented teacher, student, guardian and class-scoped assistant workflows. Account signup currently creates a personal teacher workspace; linked student and guardian views are available from its header. Teachers issue single-use, 24-hour invitation codes. Guardian relationship verification is performed by the teacher before issuing a code; this is not automated identity verification.

## Features
- Classes and student creation/editing/archiving, enrollments and withdrawal without deleting history.
- Flexible timetables: multiple weekday/time slots, multiple sessions on the same day, 1–24 weeks; weekly calendar fetched by date range. Existing duplicate sessions are skipped and class overlaps are blocked atomically by a database trigger.
- Mobile navigation, compact utility menu, dashboard shortcuts and responsive table cards.
- Attendance, class-scoped assistant access and revocation.
- Assignments, one submission per student, deadlines, 0–10 grading and feedback.
- Four-option question bank, exam question snapshots, publication controls, one attempt per student.
- Server deadline enforcement, change-based answer autosave, attempt recovery and idempotent final submission.
- Automatic grading at expiry via scheduled job every five minutes and on subsequent attempt access.
- Guardian attendance, homework/exam grades and tuition views; explicit revocation.
- In-app notifications for homework, grades, attendance and receipts; event deduplication.
- Invoices, partial payments, overpayment prevention and idempotency keys.
- Accurate overall totals and reports, tenant JSON export and audit history.
- Account management page: name, login email, phone, password and logout. Login email changes require the current password and invalidate all sessions; linked class data is retained.
- Teacher phone contact is restricted to linked, active students/guardians with call/SMS links.
- Teacher class announcements (general/schedule/homework), idempotent delivery to linked student and guardian inboxes. Publishing homework also notifies guardians. Notifications are in-app, not background push/email/SMS.
- Password change with current-password verification and revocation of all sessions.
- PWA shell; offline cache excludes all API responses and user records.
- HTTPS material links and optional external submission links; no R2 dependency. Source-file permissions remain managed at the external storage service.

## Validation
26 automated checks: 20 Node security/workflow/UI checks, 5 schema checks and one full SQLite backup/restore exercise. Integration checks cover ownership isolation, cross-class assistant denial, guardian revocation, assignment grading, exam recovery/deadlines/snapshots, receipt deduplication, notification deduplication and scheduled expiry. These are local tests using real SQLite with a D1 adapter, not a claim of production load capacity.

Eight additive migrations, including external links and class overlap protection. Public authentication shell was inspected in Chrome. Signed-in browser workflows and mobile/PWA install checks remain incomplete. Local Wrangler preview is blocked by uv_interface_addresses in this environment.

## External blockers and remaining release work
- No email sender/domain configured: email verification, password-reset email and external notifications are not implemented. Existing email addresses are not verified.
- GitHub production environment secrets are not configured; existing validation and manual release workflows are committed. Current publication is performed directly with the session-supplied Cloudflare token, which is never committed.
- Retention/deletion and consent workflows for actual child data need policy decisions and implementation before real student onboarding.
- Global lesson/invoice reports use full aggregates, and the weekly calendar queries the requested date range, but main lists show at most 500 recent records; large-dataset pagination remains to implement.
- Production load test and remote D1 disaster-recovery drill remain; local SQLite restore test does not replace these.
- Student/guardian sign-up flow still uses personal workspace creation, to be streamlined.

Full original project scope is not yet complete. No production records were fabricated for validation.

## Reference UI update
Teacher UI follows the supplied classroom-dashboard reference: light sidebar, teal actions, SVG line icons, colored statistics, today/upcoming agenda, class announcements, real attendance counts and monthly receipts. No demonstration metrics are injected into the published app. Responsive bottom navigation and compact cards are provided for phones. Timetable supports weekly time-grid, month and list views, with parallel event lanes for overlapping classes. Global class/student search and local class search are available. The application UI test covers these controls. Signed-in visual/browser QA remains limited; the local visual QA server cannot be reached by the remote browser.
