import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { getOrCreateProfile, getUserByOpenId, upsertUser } from "../db";

export type AppUser = {
  id: number;
  openId: string;
  name: string | null;
  email: string | null;
  loginMethod: string | null;
  role: "admin" | "user";
  createdAt: Date;
  updatedAt: Date;
  lastSignedIn: Date;
};

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: AppUser | null;
};

type SupabaseAuthUser = {
  id: string;
  email?: string | null;
  user_metadata?: { full_name?: string; name?: string } | null;
};

function getBearerToken(req: CreateExpressContextOptions["req"]) {
  const value = req.headers.authorization;
  return value?.startsWith("Bearer ") ? value.slice("Bearer ".length).trim() : null;
}

async function authenticateSupabaseRequest(req: CreateExpressContextOptions["req"]): Promise<AppUser | null> {
  const token = getBearerToken(req);
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_ANON_KEY ?? process.env.SUPABASE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
  if (!token || !url || !key) return null;

  const response = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: key, Authorization: `Bearer ${token}` },
  });
  if (!response.ok) return null;
  const authUser = (await response.json()) as SupabaseAuthUser;
  if (!authUser.id) return null;

  const name = authUser.user_metadata?.full_name ?? authUser.user_metadata?.name ?? authUser.email?.split("@")[0] ?? null;
  await upsertUser({ openId: authUser.id, name, email: authUser.email ?? null, loginMethod: "supabase" });
  const user = await getUserByOpenId(authUser.id);
  if (!user) return null;
  await getOrCreateProfile({ id: user.id, email: user.email });
  return user as AppUser;
}

export async function createContext(opts: CreateExpressContextOptions): Promise<TrpcContext> {
  let user: AppUser | null = null;
  try {
    user = await authenticateSupabaseRequest(opts.req);
  } catch {
    user = null;
  }
  return { req: opts.req, res: opts.res, user };
}

export { authenticateSupabaseRequest };
