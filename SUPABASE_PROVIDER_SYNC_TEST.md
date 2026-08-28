# Supabase provider and background-sync verification

The script at `scripts/test-supabase-provider-sync.mjs` validates the Supabase schema, finds an active SMM provider, retrieves its live service catalog, normalizes provider IDs and pricing, compares local mappings, checks the persisted catalog schedule and recent sync-run audit records, and optionally exercises the deployed background-sync callback.

The default mode is read-only. It does not insert or update catalog data. Use a Supabase service-role key only in a secure server-side shell; never put it in browser code or commit it to the repository.

## Required environment variables

```bash
export SUPABASE_URL="https://YOUR_PROJECT_REF.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="YOUR_SERVICE_ROLE_KEY"
```

Optional variables are `PROVIDER_ID` to target one provider, and `MARKUP_PERCENT` to validate a particular retail markup. The default markup is 150%.

## Read-only verification

```bash
node scripts/test-supabase-provider-sync.mjs
```

This checks that the required tables are reachable, the provider API returns a valid catalog, provider service IDs are unique, pricing and quantity bounds normalize correctly, local mappings can be compared, a catalog schedule record exists, and recent sync-run records are visible.

## Staging/catalog write verification

Only run this against a staging project or during an approved maintenance window:

```bash
node scripts/test-supabase-provider-sync.mjs --write
```

This upserts the provider catalog using `(provider_id, provider_service_id)`, updates `last_sync_at`, and verifies that the provider service IDs remain unique after the write. It does not create customer orders, debit wallets, or change users.

## Deployed background callback verification

To exercise the deployed cron callback, provide the production callback URL and the raw scheduled-task session value. The callback is intentionally opt-in because it runs the real background sync:

```bash
export SYNC_ENDPOINT_URL="https://YOUR_DEPLOYED_DOMAIN/api/scheduled/sync-catalog"
export SYNC_AUTH_COOKIE="YOUR_SCHEDULED_TASK_COOKIE"
node scripts/test-supabase-provider-sync.mjs --write --invoke-sync
```

The scheduled callback must already be deployed and its catalog schedule must exist in `sync_schedules`. The script expects a successful JSON response containing `ok: true` and reports the callback response for investigation.

## Expected result

A successful run ends with `RESULT: Supabase provider mapping checks passed in dry-run mode.` or `write mode.` Any failure exits with code 1 and prints the failing Supabase, provider, schema, or callback check. Review `sync_runs.error_message` and `audit_events` if the script reports recent failed runs.
