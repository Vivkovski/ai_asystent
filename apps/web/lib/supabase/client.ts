"use client";

import { createBrowserClient } from "@supabase/ssr";
import { MOCK_LOCAL_DEV_TOKEN } from "@/lib/mock-auth";

export { MOCK_LOCAL_DEV_TOKEN };

const MOCK_SESSION_KEY = "flixhome-mock-session";

function getMockSession(): { access_token: string; user: { id: string; email?: string } } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(MOCK_SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as { access_token: string; user: { id: string; email?: string } };
  } catch {
    return null;
  }
}

function setMockSession(session: { access_token: string; user: { id: string; email?: string } } | null) {
  if (typeof window === "undefined") return;
  if (session) sessionStorage.setItem(MOCK_SESSION_KEY, JSON.stringify(session));
  else sessionStorage.removeItem(MOCK_SESSION_KEY);
}

/** Mock klienta Supabase gdy brak NEXT_PUBLIC_SUPABASE_* — sesja w sessionStorage, logowanie dowolnym emaile/hasłem. */
function createMockClient(): ReturnType<typeof createBrowserClient> {
  return {
    auth: {
      getSession: () =>
        Promise.resolve({
          data: { session: getMockSession() },
          error: null,
        }),
      signInWithPassword: (opts: { email: string; password: string }) => {
        setMockSession({
          access_token: MOCK_LOCAL_DEV_TOKEN,
          user: { id: "mock-user", email: opts.email },
        });
        return Promise.resolve({ data: { user: { id: "mock-user", email: opts.email } }, error: null });
      },
      signOut: () => {
        setMockSession(null);
        return Promise.resolve({ error: null });
      },
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
  } as unknown as ReturnType<typeof createBrowserClient>;
}

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return createMockClient();
  }
  return createBrowserClient(url, anonKey);
}
