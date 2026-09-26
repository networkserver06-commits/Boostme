# Project status

## Complete

- Built the responsive Orbit Growth storefront, customer workspace, and role-gated admin dashboard.
- Implemented provider catalog sync, order submission/status tracking, wallet ledger operations, auditing, and scheduled sync endpoints.
- Replaced hosted auth/database integrations with Turso/libSQL, Drizzle SQLite schema, scrypt password auth, HTTP-only database-backed sessions, and persistent auth throttling.
- Removed unused API-key-based AI, map, speech, notification, and file-storage integrations, along with their environment variables and dependencies.
- Added regression coverage for auth, authorization, wallet invariants, provider management/sync, and safe return-path routing.

## Release and cutover

- [ ] Verify Vercel Production has `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, and `ADMIN_EMAIL` configured server-side.
- [ ] Export and reconcile existing users/profiles, providers/services, orders, wallet transactions, schedules, sync runs, and audit events into Turso before live cutover. The previous database has not been deleted, but no export credentials were available here, so no records were copied.
- [ ] Register the trusted `ADMIN_EMAIL` account before enabling public signup, or enable email verification first. With verification off, anyone claiming that email first is promoted to admin.
- [ ] Add email verification and password-reset delivery before inviting existing users; old identity-provider password hashes are not transferable to this auth implementation.
- [ ] Run production smoke tests on a separate test account and verify balances/order totals against the source backup.
