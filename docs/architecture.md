# Architecture and authorization

## Roles
- Platform admin: operational management; no automatic access to private class content.
- Tenant owner: teacher workspace administration.
- Assistant: explicit class-scoped permissions.
- Student: own linked records and assigned class content.
- Guardian: verified child links only.

## Core entities
users, auth_identities, sessions, tenants, tenant_members, students, student_accounts, guardian_links, classes, enrollments, class_schedules, lessons, attendance_records, materials, file_objects, assignments, assignment_targets, submissions, question_banks, questions, exams, exam_questions, exam_attempts, attempt_answers, grades, feedback, fee_plans, invoices, payments, notifications, notification_deliveries, audit_logs, idempotency_keys.

## Security invariants
1. Never trust a tenant identifier from the client without membership and resource checks.
2. Tenant-owned records use tenant_id and composite foreign keys where applicable.
3. Student accounts may link to multiple tenant-local student records.
4. Guardian relationships require verification and revocation.
5. Exam attempts snapshot question text, grading criteria and answer choices.
6. Never cascade-delete historical attendance, grades or payment records on unenrollment.
7. Log privileged changes; use secure sessions, CSRF protection, rate limiting, signed file access.
8. Keep production secrets outside GitHub source control.

## API namespaces
/api/v1/auth, /tenants, /classes, /students, /enrollments, /lessons, /attendance, /materials, /assignments, /submissions, /question-banks, /exams, /exam-attempts, /grades, /guardians, /notifications, /invoices, /payments, /reports.

## Data protection
Apply Vietnam's applicable personal-data and child-data protection rules; design retention, consent, export, correction and deletion workflows before real student onboarding.
