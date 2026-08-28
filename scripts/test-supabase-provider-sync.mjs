#!/usr/bin/env node

/**
 * Supabase/provider verification for Orbit Growth.
 *
 * Default mode is read-only. Use --write only against a disposable/staging
 * Supabase project when you explicitly want catalog rows upserted.
 * Use --invoke-sync with --write and SYNC_ENDPOINT_URL/SYNC_AUTH_COOKIE to
 * exercise the deployed background-sync callback.
 */

const args = new Set(process.argv.slice(2));
if (args.has("--help") || args.has("-h")) {
  console.log(`Usage: node scripts/test-supabase-provider-sync.mjs [--write] [--invoke-sync]\n\nRequired: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
Optional: PROVIDER_ID, MARKUP_PERCENT, SYNC_ENDPOINT_URL, SYNC_AUTH_TOKEN\n\nDefault behavior is read-only. --write upserts mapped catalog rows.\n--invoke-sync calls the deployed /api/scheduled/sync-catalog endpoint and\nrequires --write plus SYNC_ENDPOINT_URL and SYNC_AUTH_TOKEN.`);
  process.exit(0);
}

const writeMode = args.has("--write");
const invokeSync = args.has("--invoke-sync");
const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, "");
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const providerId = process.env.PROVIDER_ID ? Number(process.env.PROVIDER_ID) : undefined;
const markupPercent = Number(process.env.MARKUP_PERCENT ?? "150");

function fail(message) {
  throw new Error(message);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function money(value) {
  const number = Number(value);
  assert(Number.isFinite(number), `Expected a numeric value, received ${JSON.stringify(value)}`);
  return number;
}

function providerServiceId(item) {
  const id = item.service ?? item.service_id ?? item.id;
  assert(id !== undefined && id !== null && String(id).length > 0, "Provider service is missing its service ID");
  return String(id);
}

function mapRemoteService(item, selectedProviderId) {
  const rate = money(item.rate ?? item.price);
  const min = Math.trunc(money(item.min ?? item.minimum));
  const max = Math.trunc(money(item.max ?? item.maximum));
  assert(rate >= 0 && min > 0 && max >= min, `Invalid quantity/rate bounds for provider service ${providerServiceId(item)}`);
  return {
    provider_id: selectedProviderId,
    provider_service_id: providerServiceId(item),
    name: String(item.name ?? item.service_name ?? "").trim(),
    platform: String(item.category ?? item.platform ?? "Social").split(/\s+/)[0] || "Social",
    category: String(item.category ?? item.type ?? "General").trim() || "General",
    wholesale_rate_per_1k: rate.toFixed(4),
    retail_rate_per_1k: (rate * (1 + markupPercent / 100)).toFixed(4),
    min_quantity: min,
    max_quantity: max,
    is_active: true,
  };
}

async function supabaseRequest(path, options = {}) {
  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });
  const text = await response.text();
  let body;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!response.ok) fail(`Supabase ${response.status} ${response.statusText}: ${JSON.stringify(body)}`);
  return body;
}

async function providerServices(provider) {
  const response = await fetch(provider.api_url, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
    body: new URLSearchParams({ key: provider.api_key, action: "services" }),
  });
  const body = await response.json();
  if (!response.ok || (body && !Array.isArray(body) && body.error)) fail(`Provider catalog request failed: ${body?.error ?? response.statusText}`);
  assert(Array.isArray(body), "Provider catalog response is not an array");
  return body;
}

async function main() {
  assert(supabaseUrl, "SUPABASE_URL is required");
  assert(serviceRoleKey, "SUPABASE_SERVICE_ROLE_KEY is required");
  assert(Number.isFinite(markupPercent) && markupPercent >= 0 && markupPercent <= 1000, "MARKUP_PERCENT must be between 0 and 1000");
  if (invokeSync) assert(writeMode, "--invoke-sync requires --write because it exercises a live background sync");

  const requiredTables = ["app_users", "profiles", "smm_providers", "services", "orders", "wallet_transactions", "sync_schedules", "sync_runs", "audit_events", "storage_files"];
  const tableChecks = await Promise.all(requiredTables.map(async (table) => {
    await supabaseRequest(`${table}?select=*&limit=1`);
    return table;
  }));
  console.log(`PASS schema access: ${tableChecks.length} required tables reachable`);

  const providerFilter = providerId ? `id=eq.${providerId}` : "is_active=eq.true&order=last_sync_at.desc.nullslast";
  const providers = await supabaseRequest(`smm_providers?select=id,name,api_url,api_key,is_active,last_sync_at&${providerFilter}&limit=1`);
  const provider = providers[0];
  assert(provider, providerId ? `Provider ${providerId} was not found` : "No active provider was found");
  assert(provider.is_active, `Provider ${provider.id} is not active`);
  console.log(`PASS provider connection record: ${provider.name} (#${provider.id})`);

  const remote = await providerServices(provider);
  const mappedRows = remote.map((item) => mapRemoteService(item, provider.id));
  const ids = mappedRows.map((item) => item.provider_service_id);
  assert(new Set(ids).size === ids.length, "Provider returned duplicate service IDs");
  assert(mappedRows.length > 0, "Provider returned an empty catalog");
  console.log(`PASS provider catalog: ${mappedRows.length} services normalized at ${markupPercent}% markup`);

  const local = await supabaseRequest(`services?select=id,provider_id,provider_service_id,name,wholesale_rate_per_1k,retail_rate_per_1k,is_active&provider_id=eq.${provider.id}`);
  const localById = new Map(local.filter((item) => item.provider_service_id).map((item) => [String(item.provider_service_id), item]));
  const alreadyMapped = mappedRows.filter((item) => localById.has(item.provider_service_id)).length;
  const expectedNew = mappedRows.length - alreadyMapped;
  console.log(`PASS mapping comparison: ${alreadyMapped} existing, ${expectedNew} new, ${local.length} local provider rows`);

  if (writeMode) {
    await supabaseRequest("services?on_conflict=provider_id,provider_service_id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(mappedRows),
    });
    await supabaseRequest(`smm_providers?id=eq.${provider.id}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ last_sync_at: new Date().toISOString() }),
    });
    const after = await supabaseRequest(`services?select=provider_service_id&provider_id=eq.${provider.id}`);
    const afterIds = after.map((item) => String(item.provider_service_id));
    assert(new Set(afterIds).size === afterIds.length, "Idempotency check failed: duplicate local provider service IDs found");
    console.log(`PASS write/idempotency: ${mappedRows.length} catalog rows upserted without duplicate provider IDs`);
  } else {
    console.log("SKIP writes: dry-run mode is active; rerun with --write only for staging or an approved maintenance window");
  }

  const schedules = await supabaseRequest("sync_schedules?select=kind,task_uid,cron,is_active&kind=eq.catalog&limit=1");
  assert(schedules.length === 1, "No catalog sync schedule record found");
  assert(schedules[0].task_uid && schedules[0].cron, "Catalog sync schedule is missing task UID or cron expression");
  console.log(`PASS background schedule record: ${schedules[0].cron} (${schedules[0].is_active ? "active" : "paused"})`);

  const recentRuns = await supabaseRequest(`sync_runs?select=id,provider_id,kind,status,items_processed,error_message,started_at,finished_at&provider_id=eq.${provider.id}&kind=eq.catalog&order=started_at.desc&limit=5`);
  console.log(`PASS sync audit visibility: ${recentRuns.length} recent catalog run(s) available`);
  const auditEvents = await supabaseRequest(`audit_events?select=id,action,entity_type,entity_id,details,created_at&entity_type=in.(provider,provider_service)&action=in.(provider.services_synced,provider.service_mapping_failed)&order=created_at.desc&limit=10`);
  console.log(`PASS mapping audit visibility: ${auditEvents.length} recent provider mapping event(s) available`);
  if (recentRuns.some((run) => run.status === "failed")) console.warn("WARN recent catalog sync failures exist; inspect sync_runs.error_message and audit_events before enabling production writes");

  if (invokeSync) {
    const endpoint = process.env.SYNC_ENDPOINT_URL;
    const token = process.env.SYNC_AUTH_TOKEN ?? process.env.JWT_SECRET;
    assert(endpoint && token, "SYNC_ENDPOINT_URL and SYNC_AUTH_TOKEN (or JWT_SECRET) are required with --invoke-sync");
    const response = await fetch(endpoint, { method: "POST", headers: { Authorization: `Bearer ${token}`, accept: "application/json" } });
    const body = await response.json();
    assert(response.ok && body?.ok, `Background sync endpoint failed: HTTP ${response.status} ${JSON.stringify(body)}`);
    console.log(`PASS live background sync callback: ${JSON.stringify(body)}`);
  } else {
    console.log("SKIP live callback: provide --invoke-sync, SYNC_ENDPOINT_URL, and SYNC_AUTH_TOKEN to exercise the deployed cron endpoint");
  }

  console.log(`\nRESULT: Supabase provider mapping checks passed in ${writeMode ? "write" : "dry-run"} mode.`);
}

main().catch((error) => {
  console.error(`\nFAIL: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
