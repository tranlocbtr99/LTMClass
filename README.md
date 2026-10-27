# LTMClass

Teaching management for independent teachers. Vietnamese responsive teacher workspace backed by Cloudflare Workers and D1.

## Local development

Requires Node 22+ and Python 3.

```sh
npm ci
npm run check
npm test
npx wrangler d1 migrations apply ltmclass --local
npm run dev
```

Open the Wrangler local address, create a teacher account (password: minimum 12 characters), then add classes, students, enrollments, lessons and tuition records. No demo accounts or seeded personal data.

## Deployment

Run `python3 scripts/cloudflare-deploy.py` in the repository root. It requests a Cloudflare API token through hidden stdin, verifies it, reuses or creates the `ltmclass` D1 database, persists the non-secret database ID, applies migrations and deploys. It never writes the token to disk. Requires account D1 and Workers deployment permissions. Account ID is currently set to the project owner's account in the deployment helper; update it when transferring ownership.

For GitHub Actions, set `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` as production environment secrets, provision the database and commit its ID in `wrangler.jsonc`, then dispatch **Deploy LTMClass**. Validation runs on every main push and pull request. Production deployment is serialized.

## Status

Teacher, student, guardian and scoped assistant workflows deployed: https://ltmclass.tranlocbtr99.workers.dev. This is not the finished full-scope product. See [current status](docs/status.md), [architecture](docs/architecture.md) and [implementation plan](docs/implementation-plan.md).

No credentials are included in source. Sessions use secure cookies; use Wrangler's local development handling or HTTPS outside localhost. Payments are manually recorded receipts, not a payment gateway.

Teaching features include assignments, grading, question banks, timed exams, guardian views, in-app notifications, recurring schedules and reports. R2 uploads require the account owner to activate R2 first, then run the deployment helper with `--with-r2`. Email verification/recovery and full production release gates remain incomplete. See [release runbook](docs/release-runbook.md).
