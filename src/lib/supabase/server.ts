import "server-only";
import { cache } from "react";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { User, SupabaseClient } from "@supabase/supabase-js";

export const BUCKETS = {
  tradeImages: "trade-images",
  backtestImages: "backtest-images",
  tradeDocuments: "trade-documents",
} as const;

function env() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY (see .env.example)."
    );
  }
  return { url, key };
}

/** Cookie-aware Supabase client for Server Components, Route Handlers, etc. */
export async function createClient(): Promise<SupabaseClient> {
  const { url, key } = env();
  const cookieStore = await cookies();

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Called from a Server Component — proxy refreshes the session.
        }
      },
    },
  });
}

export class AuthRequiredError extends Error {
  constructor(message = "Authentication required") {
    super(message);
    this.name = "AuthRequiredError";
  }
}

/**
 * Authenticated user + client. Deduped per request via React `cache()` so
 * multiple store calls in one API handler only hit auth once.
 */
export const requireUser = cache(async (): Promise<{
  supabase: SupabaseClient;
  user: User;
}> => {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new AuthRequiredError();
  }

  return { supabase, user };
});

/** @deprecated Use createClient() / requireUser() */
export async function getSupabase(): Promise<SupabaseClient> {
  return createClient();
}
