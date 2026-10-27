# Deployment and recovery

## Current runtime
- Worker: ltmclass
- D1: ltmclass, five additive migrations
- Cron: every five minutes, grades expired attempts and deletes expired sessions/rate limits/invites
- Optional R2 binding: FILES, private ltmclass-files bucket

## Validation
Run npm ci, npm run check and npm test. Validate Worker packaging with npx wrangler deploy --dry-run. Tests do not use production records.

## Publication
Run python3 scripts/cloudflare-deploy.py. Token is read without echo via stdin and only passed in the child-process environment. It provisions/reuses D1, persists the non-secret database ID, applies migrations and deploys.

After the account owner enables R2 in Cloudflare Dashboard, run python3 scripts/cloudflare-deploy.py --with-r2. This creates/reuses the private bucket, binds FILES and publishes. Commit the resulting non-secret binding configuration. Never expose the bucket publicly.

For GitHub releases, configure production environment secrets CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID. Dispatch Deploy LTMClass. The connector cannot provision these repository secrets. Deployment jobs are serialized.

## Recovery
Use Cloudflare D1 Time Travel/backups for production recovery according to the account's actual retention. Before any destructive schema/data operation, create an authenticated D1 export outside Git and verify restoration into a separate database. Do not restore over live data before review. Current migrations only add tables, indexes or triggers; roll back Worker code separately from schema. A previous Worker version is not a database rollback.

The restore test exercises SQLite backups and integrity locally with synthetic data. No production disaster-recovery drill or retention guarantee has been claimed.
