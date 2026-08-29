export type SupabaseBrowserConfig = {
  url: string;
  key: string;
};

type PublicEnv = Record<string, unknown>;

function asString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function resolveSupabaseBrowserConfig(env: PublicEnv): SupabaseBrowserConfig | null {
  const url = asString(env.VITE_SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL)?.replace(/\/$/, "");
  const key = asString(
    env.VITE_SUPABASE_ANON_KEY ??
      env.VITE_SUPABASE_KEY ??
      env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
      env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
  return url && key ? { url, key } : null;
}

const viteEnv = (import.meta as ImportMeta & { env?: PublicEnv }).env ?? {};
export const supabaseBrowserConfig = resolveSupabaseBrowserConfig(viteEnv);
