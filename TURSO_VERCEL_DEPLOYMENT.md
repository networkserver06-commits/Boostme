# Turso + Vercel deployment

Boostme uses **Turso/libSQL (SQLite)** for application data and app-managed email/password authentication. No separate hosted-auth or REST database service is required. Its schema is created idempotently on first server request in each serverless process.

## Required Vercel variables

Set these on the Vercel project for **Production** and Preview as needed. Redeploy after changing them.

| Variable | Required | Notes |
|---|---:|---|
| `TURSO_DATABASE_URL` | Yes | Turso database URL (`libsql://…`). Server-only; never expose as a `VITE_` variable. |
| `TURSO_AUTH_TOKEN` | Yes | Token for the database URL. Server-only; never commit or expose in client code. |
| `ADMIN_EMAIL` | Yes | Email promoted to the `admin` role at registration, signin, or session load. |
| `JWT_SECRET` | Yes for cron | Server-only bearer secret accepted by scheduled provider-sync endpoints. |
| `BASE_URL` | Optional | Provider API endpoint for ShakerGain bootstrap when no active provider exists. |
| `API_KEY` | Optional | Server-only provider API key paired with `BASE_URL`. |
| `BUILT_IN_FORGE_API_URL` | If using generated assets | Server-side S3-compatible asset storage endpoint. |
| `BUILT_IN_FORGE_API_KEY` | If using generated assets | Server-only asset-storage credential. |

`TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, and `ADMIN_EMAIL` are the database/auth settings. Preserve the existing cron, provider, and asset-storage variables for those features.

## Database initialization

On startup, the server batches idempotent `CREATE TABLE/INDEX IF NOT EXISTS` statements for users, profiles, providers, services, orders, wallet transactions, schedules, sync runs, audit events, sessions, and authentication throttles. This creates a **new schema** in the configured Turso database; it does not copy records from the previous database.

For local development, the server defaults to `./.data/boostme.db` when Turso credentials are absent. Tests use an isolated in-memory SQLite database. Local database files are excluded from Git.

## Authentication behavior and security note

Passwords are stored as salted scrypt hashes; raw passwords are neither stored nor returned by the API. The browser receives a random HTTP-only `SameSite=Lax` session cookie. Only the cookie hash is stored in Turso; sessions expire after 30 days and logout revokes the server-side record. Signin/registration attempts are throttled by hashed email/IP keys in Turso.

**Email verification and password-reset email are not implemented yet**, as requested for the temporary transition. Without verification, anyone who signs up first using the configured `ADMIN_EMAIL` can create an account that is automatically promoted to administrator. Keep public registration closed until the trusted administrator account is registered, or enable email verification before opening signup. An email address alone is not proof of ownership.

## Existing data and account cutover

This code change does not delete or modify the previous database. However, the new app reads the configured Turso database, so users, wallet balances, orders, services, providers, and audit history will not appear until they are exported and imported. No source database credentials or export were available in this sandbox, so **no records were copied**.

Previous authentication-provider password hashes cannot be migrated into this app-managed password system. Existing customers will need to create a new password. Take an export/backup of all business tables before production cutover; preserve ledger/order relationships and validate totals against the source system.

## Verification and release

Run:

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm test
pnpm build
```

Before production use, verify the Vercel deployment uses the intended Turso database, check `/auth`, register a test user in a non-production database, verify its HTTP-only cookie and `auth.me` session, test logout/revocation, and exercise an admin-only route. Do not use real customer wallet/order data for the first end-to-end test.

A daily provider-catalog cron remains configured in `vercel.json`; scheduled requests require `Authorization: Bearer $JWT_SECRET`. Object downloads use the existing Forge/S3-compatible storage proxy at `/manus-storage/*`, independent of the database.
