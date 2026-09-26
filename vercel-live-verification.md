# Production verification status

## Database replacement readiness

- Application code uses `@libsql/client` + Drizzle and app-managed password/cookie auth; prior hosted-auth and REST database integrations are removed from runtime code.
- Automated schema initialization creates Turso tables and indexes when the configured database is first contacted.
- Unit tests use in-memory SQLite and cover account creation, password verification, session issuance/revocation, admin promotion, throttling, provider sync, and ledger invariants.
- No production Turso connection was made from this sandbox, and no production records have been copied.
- **Production cutover is not data-complete until existing service, provider, order, wallet, user/profile, schedule, run, and audit records are exported and reconciled in Turso.** The old database was not deleted.

## Required live checks after deployment

1. Confirm Vercel Production has `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, and `ADMIN_EMAIL` configured server-side, plus existing cron/provider variables for enabled features.
2. Visit `/auth` using a test database/account and confirm the browser receives an HTTP-only session cookie.
3. Verify `/api/trpc/auth.me` returns the current user after signin and `null` after logout.
4. Confirm non-admin users cannot access admin procedures; test the configured admin account separately.
5. Confirm scheduled-sync routes return the expected status and provider sync behaves correctly.
6. Compare imported user/order counts, wallet balances, and ledger totals against an untouched source backup before directing customers to the new database.

Do not enable public no-verification signup until the trusted `ADMIN_EMAIL` account is registered; otherwise anyone can claim that address and be promoted to admin. Email verification and reset delivery remain follow-up work.
