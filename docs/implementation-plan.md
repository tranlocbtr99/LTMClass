# Implementation plan

## Phase 1 — foundation
- Monorepo: apps/web, apps/api, packages/shared, db/migrations.
- Auth/session management, multi-tenant RBAC, CI, staging environment.
- Class and student CRUD, enrollment, audit logging.

## Phase 2 — teaching
- Class schedules, lessons, attendance and guardian notifications.
- Materials, assignments, submissions and teacher grading.

## Phase 3 — online exams (MVP)
- Question bank, exam publishing, attempt snapshots, server-authoritative timer.
- Autosave, idempotent submission, scoring and reporting.

## Phase 4 — guardian and billing
- Guardian linking and portal, notification preferences and delivery status.
- Invoices, payment recording, reconciliation, reporting.

## Phase 5 — release readiness
- Tenant-isolation and authorization tests.
- Load tests, backup/restore drill, accessibility and mobile/PWA checks.
- Deployment runbook and release gates.

## Definition of done
No cross-tenant reads/writes, verified guardian access, reliable exam recovery, no duplicate notifications, auditable payment and grade changes, and tested restore procedures.
