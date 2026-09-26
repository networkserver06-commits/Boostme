import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { loadSessionUser, readSessionToken } from "./passwordAuth";

export type AppUser = {
  id: number;
  name: string | null;
  email: string;
  loginMethod: string;
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

export async function createContext(opts: CreateExpressContextOptions): Promise<TrpcContext> {
  let user: AppUser | null = null;
  try {
    const session = await loadSessionUser(readSessionToken(opts.req));
    user = session.user as AppUser | null;
  } catch (error) {
    console.error("[auth] Could not load session", error instanceof Error ? error.message : "unknown error");
  }
  return { req: opts.req, res: opts.res, user };
}
