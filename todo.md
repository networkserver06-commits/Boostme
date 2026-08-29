# Project TODO

- [x] Establish the elegant dark-mode visual system, typography, responsive layout, and navigation shell.
- [x] Build the public landing page with service positioning, social proof-safe trust messaging, CTA sign-in flow, and interactive pricing preview.
- [x] Preserve and wire Manus OAuth authentication with client/admin role-aware routes and guarded operations.
- [x] Add SMM domain schema for profiles, providers, services, orders, wallet transactions, sync runs, and audit events.
- [x] Implement wallet ledger primitives with atomic balance-safe order charging and transaction history.
- [x] Implement client dashboard metrics, catalog browsing, order creation, validation, and order history/status tracking.
- [x] Implement provider integration layer for catalog import, fulfillment submission, status mapping, retries, and error reporting.
- [x] Implement admin dashboard for pricing/markup, services, providers, orders, wallet activity, and key metrics.
- [x] Implement scheduled provider catalog and outstanding-order synchronization with audit visibility and resilient failures.
- [x] Add Vitest coverage for authentication, authorization, wallet/order invariants, provider status mapping, and sync behavior.
- [x] Run type checks, tests, and responsive visual verification; resolve any issues before delivery.
- [x] Save the completed project checkpoint and provide the version to the user.

## Requirement history

- [x] User requested a polished social-media growth platform with secure client and administrator experiences.

## Follow-up hardening

- [x] Hide and guard admin routes and navigation based on the authenticated user role.
- [x] Make wallet charging race-safe with a row lock or conditional balance update and correct pending-ledger balances.
- [x] Add platform-specific target URL validation plus order status filtering and refresh behavior.
- [x] Submit provider orders during order creation, persist provider order IDs, and retry transient provider failures.
- [x] Add admin orders and wallet activity views plus explicit markup controls.
- [x] Create real heartbeat jobs for catalog and order sync, persist task UIDs, and include all outstanding statuses.
- [x] Add Vitest coverage for admin authorization, wallet/order invariants, scheduled sync, and provider fulfillment.
- [x] Perform responsive visual verification at desktop and mobile breakpoints.

## Final hardening pass

- [x] Fix pending deposit ledger entries so balanceAfter reflects correct pending-balance semantics.
- [x] Add explicit administrator markup percentage controls and derived retail pricing.
- [x] Expand scheduled order sync to include pending and partial outstanding orders.
- [x] Add Vitest coverage for wallet deduction/refund invariants and scheduled sync handling.
- [x] Capture and review responsive screenshots for dashboard and admin pages.

## Last quality pass

- [x] Recalculate retail pricing whenever wholesale cost changes and keep saved pricing aligned with the displayed markup.
- [x] Add tests for refund invariants and scheduled sync success/failure behavior.

## Test completeness

- [x] Add focused refundOrder tests for balance updates, failed-order marking, and refund ledger insertion.
- [x] Add scheduledSyncHandler tests for cron-only authentication and sync completion/failure paths.

## Direct handler coverage

- [x] Exercise refundOrder itself with a mocked transaction database.
- [x] Exercise scheduledSyncHandler itself for cron rejection and provider-sync completion/error paths.

## Final scheduled-sync coverage

- [x] Test successful scheduled provider polling and completed sync-run updates.
- [x] Test provider polling failure handling and resulting sync-run state.

## Provider service mapping feature

- [x] Add admin provider catalog preview and safe production-service import controls.
- [x] Add mapping persistence for provider service IDs, local service metadata, markup, and availability.
- [x] Add selected-service sync with resilient per-service errors and audit visibility.
- [x] Build an admin mapping interface with filters, selection, mapping status, and feedback states.
- [x] Add Vitest coverage for mapping authorization, sync success, and partial provider failures.
- [x] Verify the mapping UI responsively and save a feature checkpoint.

## Provider mapping hardening

- [x] Make selected-service sync resilient with per-service outcomes and detailed audit visibility.
- [x] Add direct tests for admin provider catalog/mapping authorization and partial sync failures.
- [x] Save a new checkpoint after the provider-mapping feature is fully verified.

## Direct mapping sync coverage

- [x] Exercise admin.syncProviderServices with mixed success/failure and assert partial outcomes plus audit behavior.

## Audit assertion

- [x] Assert per-service failure and summary audit events in the provider-mapping test.

## GitHub delivery

- [x] Verify access to https://github.com/networkserver06-commits/Boostme and inspect its main branch state.
- [x] Run the project verification suite before publishing.
- [x] Commit the current project update and push it to the repository main branch.
- [x] Confirm the remote commit and report the GitHub delivery result.

## Supabase migration request

- [x] Map the existing MySQL/Drizzle platform tables to Supabase/Postgres equivalents.
- [x] Draft paste-ready Supabase SQL for application tables, storage metadata, indexes, triggers, and RLS policies.
- [x] Validate the SQL structure and provide setup/integration notes without executing it against production.

## Supabase handoff validation

- [x] Validate supabase_migration.sql with a PostgreSQL-compatible parser or structural checks.
- [x] Deliver the SQL file with concise paste-and-configure instructions.

## Supabase provider verification script

- [x] Add a safe Node test script for Supabase connectivity and schema checks.
- [x] Verify provider catalog mapping fields, markup derivation, idempotency, and sync audit records.
- [x] Verify background sync schedule/run records and support dry-run by default with explicit write opt-in.
- [x] Run the script in dry-run mode and deliver usage instructions.

## Supabase test execution hardening

- [x] Add an explicit recent audit-event verification to the Supabase test script.
- [x] Detect whether Supabase test credentials are available without exposing them; run a real dry-run when supplied or clearly report that credentialed execution is pending.
- [x] Deliver the finalized script and instructions to the user.

## Live Supabase verification

- [x] Receive available Supabase credentials securely for the live read-only test.
- [x] Run the provider mapping and background-sync verification against live Supabase; schema access passed and no active provider was configured.
- [x] Report the live connectivity and synchronization results without exposing credentials.

## Hosting request

- [x] Verify the project build and runtime requirements for external hosting compatibility.
- [x] Document the supported publish path and the custom-domain setup for boost.leetec.online.
- [x] Explain Vercel compatibility limitations for the current full-stack scheduled-sync architecture.

## Vercel rendering bug

- [x] Identify why the Vercel deployment is showing source code instead of the built application.
- [x] Align the Vercel build/output/runtime configuration with the project structure.
- [x] Verify the fix locally and document the exact Vercel redeploy settings.

## Vercel deployment verification

- [x] Inspect the actual Vercel project settings and live deployment URL to confirm the root cause.
- [x] Choose and document either full Vercel serverless support or a frontend-only Vercel deployment with the backend kept on Manus.
- [x] Document the exact Supabase environment-variable and Vercel redeploy settings; live verification remains user-triggered after redeploy.

## Sign-up navigation bug

- [x] Reproduce the non-working sign-up action on the live landing page.
- [x] Fix the sign-up CTA/tab to reliably start the authentication flow.
- [x] Verify the sign-up action locally; deployed verification is user-triggered after redeploy.

## OAuth deployment hardening

- [x] Use the dedicated OAuth portal URL for the interactive login start route.
- [x] Add coverage for the selected OAuth portal URL source.
- [x] Push the fix and verify `/api/oauth/start` on the live custom domain.

## Live Vercel API routing gap

- [x] Configure Vercel to build and route the Express API function explicitly alongside the Vite static output.
- [x] Superseded live OAuth endpoint verification by removing the OAuth endpoint during Supabase migration.

## Vercel frozen-install failure

- [x] Resolve the pnpm patchedDependencies mismatch between package.json and pnpm-lock.yaml.
- [x] Verify `pnpm install --frozen-lockfile` succeeds from a clean dependency state.
- [x] Re-run type checks, tests, and production build before pushing the deployment fix.
- [x] Push the corrected package metadata and lockfile to GitHub main for Vercel redeploy.

## Live OAuth function crash

- [x] Superseded OAuth environment configuration by removing the OAuth runtime dependency.
- [x] Superseded legacy OAuth redirect verification by the Supabase Auth page and bearer-token flow.

## GitHub Vercel-fix delivery

- [x] Inspect local Vercel fix changes and configured GitHub remote.
- [x] Verify the deployment fix with local type, test, and build checks if new changes are present.
- [x] Push the Vercel deployment fix to `networkserver06-commits/Boostme` on `main`.
- [x] Confirm the remote commit and provide Vercel redeploy instructions.

## Supabase runtime migration

- [x] Replace Manus OAuth runtime dependency with Supabase Auth session handling for Vercel.
- [x] Replace MySQL/Drizzle runtime access with Supabase Postgres access using server-only credentials.
- [x] Preserve role-aware client/admin access, wallet/order invariants, provider mapping, and sync workflows.
- [x] Wire Supabase Storage for application file access without exposing service-role credentials.
- [x] Add migration tests and update Vercel environment/deployment documentation.

## Continued Supabase migration

- [x] Inventory remaining MySQL, Manus OAuth, and storage helper dependencies in the runtime.
- [x] Implement a Supabase server client and compatible auth/database adapter without exposing service credentials.
- [x] Preserve provider mapping, wallet/order, admin, and scheduled-sync behavior on the new adapter.
- [x] Run full checks and prepare the migration changes for GitHub main and Vercel redeploy.

## Supabase migration continuation

- [x] Fix Supabase query-builder duplicate `values` identifier and compile errors.
- [x] Keep isolated wallet-refund tests compatible with the Supabase migration.
- [x] Make live Supabase credential verification explicitly opt-in.
- [x] Replace tRPC request context Manus authentication with Supabase Auth REST verification.
- [x] Remove Manus OAuth route registration from the Express production path.
- [x] Rewrite scheduled provider sync to use Supabase PostgREST and Vercel cron authentication.
- [x] Remove remaining client-side Manus OAuth/sessionStorage references.
- [x] Remove remaining server-side Drizzle/MySQL/Manus runtime dependencies from production paths.
- [x] Run full checks, build, and Supabase provider-sync verification.
- [x] Push final Supabase/Vercel migration to GitHub main.

## Final migration gap closure

- [x] Add a Vercel/Supabase deployment handoff document with environment, auth, storage, cron, and redeploy settings.
- [x] Exercise the local Supabase Auth page, toggle sign-up mode, submit shaped fields, and verify the missing-browser-configuration message.
- [x] Add refresh-token persistence and renewal for Supabase Auth sessions.
- [x] Restrict server database writes to server-side Supabase credentials only.
- [x] Re-run live provider-sync verification and clearly document the no-active-provider limitation if no provider is configured.

## Admin provider management feature

- [x] Add admin provider CRUD/update procedures with server-side credential protection.
- [x] Add an admin procedure to trigger provider catalog synchronization manually with audit visibility.
- [x] Build the provider management interface with provider status, endpoint, markup, and sync controls.
- [x] Add loading, success, failure, and partial-sync feedback states to the admin UI.
- [x] Add Vitest coverage for provider authorization, management updates, and manual synchronization.
- [x] Verify the provider workspace responsively and save a feature checkpoint.

## Provider management hardening

- [x] Sanitize provider list responses so API keys never reach the browser.
- [x] Add edit and delete provider controls with safe credential preservation.
- [x] Surface partial synchronization failures with actionable admin feedback.
- [x] Add focused tests for provider save/update/toggle/test and manual sync outcomes.
- [x] Verify the provider workspace layout and controls through the responsive admin implementation and route guard; authenticated live preview requires a configured admin session.

## GitHub delivery continuation

- [x] Push checkpoint `9746d1bc` to `networkserver06-commits/Boostme` `main` and verify the remote commit at `b741d5a`.

## Vercel and Supabase storage verification

- [x] Verify GitHub main contains the latest Supabase/provider-management release and compare it with the local checkpoint.
- [x] Audit application storage helpers and imports for any remaining non-Supabase storage path.
- [x] Check the live custom-domain routes after the GitHub push and identify the required Vercel redeploy and environment configuration.
- [x] Report verified deployment and storage readiness without overstating live functionality.

## Vercel serverless import fix

- [x] Split the API app factory from local Vite/bootstrap imports.
- [x] Produce and include a bundled server app artifact for the Vercel API function.
- [x] Verify the Vercel-compatible production build, tests, and local API handler loading.
- [x] Push the serverless runtime fix to GitHub main at `5d50d72` and provide redeploy verification steps.

## Vercel post-push verification

- [x] Document exact Vercel redeploy steps for commit `5d50d72`, required environment variables, and post-deploy checks.
- [x] Verify the live custom domain after the latest deployment attempt; `/auth` and `/api/trpc/auth.me` still return Vercel 404s, so the correct Vercel deployment assignment remains pending.

## Vercel schema correction

- [x] Correct `functions.api/[...path].ts.includeFiles` to the schema-required string form.
- [x] Validate the corrected Vercel configuration, tests, and production build.
- [x] Push the corrected configuration to GitHub main at `f030d6e` and provide the redeploy commit.

## Final Vercel fix confirmation

- [x] Confirm GitHub main points to the corrected Vercel schema commit `f030d6e`; local code is consistent with the pushed application.
- [x] Re-run the final configuration, type, test, and production build checks.
- [x] Report that live Vercel redeployment has not been independently confirmed and remains user-triggered.

## Vercel configuration conflict correction

- [x] Remove the incompatible `functions` block while preserving the working `builds` configuration.
- [x] Validate the conflict-free Vercel JSON, application checks, and production build.
- [x] Push the conflict-free configuration to GitHub main at `847ef3f` and provide the new redeploy commit.

## Vercel deployment failure remediation

- [x] Inspect the current Vercel build configuration and API runtime failure path.
- [x] Implement the Vercel-compatible deployment fix and add a deterministic smoke check.
- [x] Run configuration, type, test, production-build, and API-entrypoint validation.
- [x] Push the final deployment fix to GitHub main at `5579291` and report the redeploy commit.

## Final Vercel stale-import remediation

- [x] Inspect every API entrypoint and build output for references to `server/_core/index`.
- [x] Remove the stale runtime import from the Vercel function and add a direct-source entrypoint assertion.
- [x] Run configuration, type, tests, production build, and API-entrypoint smoke checks.
- [x] Push the final stale-import fix to GitHub main at `0ec1ba0` and report the redeploy commit.

## Vercel Hobby cron compatibility

- [x] Remove sub-daily Vercel cron declarations that are blocked on Hobby accounts.
- [x] Preserve provider synchronization through the admin manual-sync controls and document the daily cron behavior.
- [x] Validate the Hobby-compatible configuration, tests, and production build.
- [x] Push the Hobby-compatible deployment fix to GitHub main at `2a6ce06` and report the commit.

## Live Auth route 404 remediation

- [x] Confirm the current Vercel SPA fallback and API routing behavior for `/auth`.
- [x] Implement a robust Vercel client-route fallback that preserves `/api/*` functions.
- [x] Validate the route configuration and production build.
- [x] Push the `/auth` route fix to GitHub main at `c0a6c11` and provide redeploy instructions.

## Physical SPA route fallback

- [x] Generate physical `auth`, `admin`, and `dashboard` route entrypoints in `dist/public` during the production build.
- [x] Validate the generated route artifacts and all application checks.
- [x] Push the route-artifact fallback to GitHub main at `60e764d` and provide the redeploy commit.

## Final live Vercel resolution

- [x] Recheck the live Auth/API routes and confirm which deployment is serving the custom domain.
- [x] Apply the remaining Vercel routing/build correction needed for direct client routes.
- [x] Validate the final route artifacts, application checks, and serverless entrypoint.
- [x] Push the final live-routing fix to GitHub main and report the redeploy commit.

## Live API route resolution

- [x] Add an explicit Vercel `/api/*` rewrite to the catch-all serverless function before the SPA fallback.
- [x] Validate API routing configuration, build, and serverless entrypoint.
- [x] Push the API route fix to GitHub main and report the redeploy commit.
- [x] Recheck the live tRPC endpoint after Vercel redeploy.

## Vercel API bundle packaging

- [x] Include the generated `dist/app.js` bundle in the Vercel catch-all function using schema-valid function configuration.
- [x] Validate the combined Vercel config and production serverless bundle.
- [x] Push the packaging fix to GitHub main and recheck the live API response after redeploy.

## Supabase environment verification

- [x] Verify the live Auth route and unauthenticated tRPC response after Supabase variables were added to Vercel.
- [x] Run local regression checks and confirm the Supabase server adapter requires only server-side credentials.
- [x] Record the live verification result and distinguish environment readiness from provider/admin workflow testing.

## Existing Vercel Supabase variable compatibility

- [x] Support the existing `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` names in the browser Auth and session code.
- [x] Expose the existing `NEXT_PUBLIC_*` variables through the Vite production build without exposing server-only keys.
- [x] Validate the live Auth configuration after the compatibility fix redeploys.

## ShakerGain provider integration

- [x] Add idempotent server-only bootstrap from Vercel `BASE_URL` and `API_KEY` when no active provider exists.
- [x] Support ShakerGain catalog aliases (`services` and `Category`) across preview, mapping, and scheduled sync.
- [x] Add regression coverage and run safe catalog connectivity checks without creating orders.
- [ ] Push the ShakerGain integration and save a final checkpoint.
