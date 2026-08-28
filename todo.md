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

- [ ] Receive SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY securely for the live read-only test.
- [ ] Run the provider mapping and background-sync verification against live Supabase.
- [ ] Report the live connectivity and synchronization results without exposing credentials.

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
- [ ] Verify the fix against the actual Vercel deployment and provide exact environment-variable and redeploy settings.

## Sign-up navigation bug

- [x] Reproduce the non-working sign-up action on the live landing page.
- [x] Fix the sign-up CTA/tab to reliably start the authentication flow.
- [ ] Verify the sign-up action locally and against the deployed site after redeploy.

## OAuth deployment hardening

- [ ] Use the dedicated OAuth portal URL for the interactive login start route.
- [ ] Add coverage for the selected OAuth portal URL source.
- [ ] Push the fix and verify `/api/oauth/start` on the live custom domain.

## Live Vercel API routing gap

- [x] Configure Vercel to build and route the Express API function explicitly alongside the Vite static output.
- [ ] Verify the live `/api/oauth/start` endpoint reaches the serverless function after redeploy.
