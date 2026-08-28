import crypto from "node:crypto";

const BUCKET = "orbit-assets";

function getStorageConfig() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_KEY;
  if (!url || !key) throw new Error("Supabase Storage config missing: set SUPABASE_URL and a server-side Supabase key");
  return { url, key };
}

function normalizeKey(relKey: string) { return relKey.replace(/^\/+/, ""); }
function appendHashSuffix(relKey: string) {
  const hash = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const lastDot = relKey.lastIndexOf(".");
  return lastDot === -1 ? `${relKey}_${hash}` : `${relKey.slice(0, lastDot)}_${hash}${relKey.slice(lastDot)}`;
}

export async function storagePut(relKey: string, data: Buffer | Uint8Array | string, contentType = "application/octet-stream") {
  const { url, key } = getStorageConfig();
  const objectKey = appendHashSuffix(normalizeKey(relKey));
  const response = await fetch(`${url}/storage/v1/object/${BUCKET}/${objectKey}`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": contentType, "x-upsert": "false" },
    body: typeof data === "string" ? data : new Uint8Array(data),
  });
  if (!response.ok) throw new Error(`Supabase Storage upload failed (${response.status}): ${await response.text()}`);
  return { key: objectKey, url: await storageGetSignedUrl(objectKey) };
}

export async function storageGet(relKey: string) {
  const objectKey = normalizeKey(relKey);
  return { key: objectKey, url: await storageGetSignedUrl(objectKey) };
}

export async function storageGetSignedUrl(relKey: string, expiresIn = 3600) {
  const { url, key } = getStorageConfig();
  const objectKey = normalizeKey(relKey);
  const response = await fetch(`${url}/storage/v1/object/sign/${BUCKET}/${objectKey}`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ expiresIn }),
  });
  if (!response.ok) throw new Error(`Supabase Storage signed URL failed (${response.status}): ${await response.text()}`);
  const body = await response.json() as { signedURL?: string; signedUrl?: string };
  const signed = body.signedURL ?? body.signedUrl;
  if (!signed) throw new Error("Supabase Storage returned no signed URL");
  return signed.startsWith("http") ? signed : `${url}/storage/v1${signed}`;
}
