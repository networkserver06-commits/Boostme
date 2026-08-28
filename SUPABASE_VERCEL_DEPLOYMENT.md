# Supabase and Vercel deployment handoff

This project now uses **Supabase Auth**, **Supabase PostgREST**, and **Supabase Storage**. Manus OAuth, the Manus session cookie, Manus-managed MySQL access, and the Manus storage proxy are no longer part of the production request path.

## Supabase setup

Run `supabase_migration.sql` once in the Supabase SQL Editor. The migration creates the application tables, private `orbit-assets` storage bucket, indexes, triggers, wallet helper, and RLS defaults. Configure at least one active row in `smm_providers` before running provider catalog or order synchronization; otherwise the verification script correctly reports that connectivity succeeded but no provider is available to sync.

## Vercel environment variables

| Variable | Required | Purpose |
|---|---:|---|
| `SUPABASE_URL` | Yes | Server-side Supabase project URL. |
| `SUPABASE_SERVICE_ROLE_KEY` or `SUPABASE_SECRET_KEY` | Yes | Server-only key for PostgREST writes and private Storage operations. Never expose it as a `VITE_` variable. |
| `SUPABASE_KEY` | Optional | Server-side fallback key when the deployment uses one Supabase key for both API calls and database access. Prefer the service-role/secret key for this backend. |
| `VITE_SUPABASE_URL` | Yes | Browser-safe Supabase project URL used by the Auth page. |
| `VITE_SUPABASE_ANON_KEY` or `VITE_SUPABASE_KEY` | Yes | Browser-safe publishable/anon key used for email/password sign-in, sign-up, and refresh-token renewal. Do not put a service-role key in either variable. |
| `JWT_SECRET` | Yes | Shared secret used to authenticate Vercel cron callbacks. |
| `OWNER_NAME` | Recommended | Owner label used by existing application metadata. |

Supabase Auth email confirmation settings determine whether sign-up immediately returns a session or asks the user to confirm their email. Add the production site URL and `/auth` path to Supabase Auth redirect/site settings as appropriate for the project domain.

## Vercel configuration

Use the repository root as the Vercel project root. The committed `vercel.json` builds `api/[...path].ts` as the Node function, builds the Vite client into `dist/public`, routes `/api/*` to the function, and declares catalog and order cron schedules. After adding the environment variables in **Production**, redeploy from the `main` branch. The scheduled handlers accept `Authorization: Bearer <JWT_SECRET>` and also accept an optional `x-task-uid` header for audit correlation.

## Auth behavior

The `/auth` page calls Supabase Auth directly with the browser-safe key. Successful sign-in stores the access and refresh tokens in local storage under `supabase-auth-session`; the client renews an expired access token with the refresh token before the application requests begin. tRPC sends only the current access token to the server. The server validates that token through Supabase Auth, upserts the corresponding `app_users` row by the Supabase Auth UUID, and creates the wallet profile if necessary.

## Verification

Run `pnpm install --frozen-lockfile`, `pnpm check`, `pnpm test`, and `pnpm build`. The live verification command is `node scripts/test-supabase-provider-sync.mjs`. It is read-only by default. It should report table reachability and, when an active provider exists, validate provider mapping and sync records. `--write` is required for staging catalog changes, and `--invoke-sync` additionally requires `SYNC_ENDPOINT_URL` and `SYNC_AUTH_COOKIE`.

## Security notes

Keep all server-side Supabase service-role or secret keys in Vercel server environment variables only. The browser must use only the anon/publishable key. The application’s PostgREST adapter maps camelCase application fields to snake_case database fields and keeps provider credentials on the server side. The storage bucket remains private and returns signed URLs rather than public object URLs.

## Redeploy checklist for the serverless import fix

The serverless runtime correction is committed to GitHub `main` as `5d50d72`. In Vercel, open the project connected to `networkserver06-commits/Boostme`, confirm the Production branch is `main`, and select **Redeploy** for the deployment built from `5d50d72` (or push a new commit if the project is not connected to GitHub). Keep the project root at the repository root and do not override the committed build configuration.

Before redeploying, confirm Production contains `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` or `SUPABASE_SECRET_KEY`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` or `VITE_SUPABASE_KEY`, `JWT_SECRET`, and `OWNER_NAME`. Never place the server-side key in a `VITE_` variable.

After deployment, check `/` for the landing page, `/auth` for the Supabase Auth page, and `/api/trpc/auth.me` for a normal unauthenticated response rather than a `500` or `ERR_MODULE_NOT_FOUND`. Sign in with a Supabase Auth account, open `/admin` with an account whose `app_users.role` is `admin`, and test provider listing, provider connection test, and manual synchronization. In Vercel function logs, the previous `Cannot find module '/var/task/server/_core/index'` error should be absent.
