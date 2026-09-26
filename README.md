# Boostme

Orbit Growth — customer orders, wallet activity, delivery updates, and administrator controls.

## Database and authentication

Application data is stored in Turso/libSQL. On first use, the server creates the SQLite-compatible schema idempotently. App-managed password authentication uses salted scrypt hashes and HTTP-only session cookies; email verification and password-reset delivery are not enabled yet.

For Vercel deployment, configure `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, and `ADMIN_EMAIL` as server-only environment variables. Review [Turso + Vercel deployment](./TURSO_VERCEL_DEPLOYMENT.md) for schema bootstrap, cutover caveats, and security details.

> Before opening public signup, register the trusted `ADMIN_EMAIL` account or enable email verification. While verification is disabled, anyone who claims that address first is promoted to admin.

## Development

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Without Turso credentials, the server uses `./.data/boostme.db` locally. Unit tests use an in-memory SQLite database.

## Validation

```sh
pnpm check
pnpm test
pnpm build
```

The configured database is a new Turso schema. Existing user, wallet, order, provider, and audit data must be exported, imported, and reconciled before production cutover; this change does not delete the source database or migrate accounts/passwords automatically.
