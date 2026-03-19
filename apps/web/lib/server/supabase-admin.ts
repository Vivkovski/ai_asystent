/**
 * Supabase client with service_role for server-side only. Do not expose to client.
 * W dev bez env zwracany jest mock zwracający puste dane (dla trybu mock na localu).
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";

const empty = Promise.resolve({ data: [] as Record<string, unknown>[], error: null });
const nullSingle = Promise.resolve({ data: null, error: null });
const noop = Promise.resolve({ error: null });

/** Minimalny wiersz zwracany przez insert().select().single() w mocku. */
const fakeRow = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: "mock-id",
  tenant_id: "mock-tenant",
  user_id: "mock-user",
  title: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  conversation_id: "mock-conv-id",
  role: "assistant",
  content: "",
  status: "done",
  ...overrides,
});

function createMockSupabaseClient(): SupabaseClient {
  /** Thenable: await chain zwraca { data: [] }, żeby zapytania kończące się na .order()/.eq() bez .limit() działały. */
  const chain = {
    select: () => chain,
    eq: () => chain,
    order: () => chain,
    limit: () => empty,
    in: () => chain,
    maybeSingle: () => nullSingle,
    single: () => nullSingle,
    then(resolve: (v: { data: Record<string, unknown>[]; error: null }) => void) {
      resolve({ data: [], error: null });
    },
  };
  const insertChain = {
    select: () => ({ single: () => Promise.resolve({ data: fakeRow(), error: null }) }),
  };
  return {
    from: () =>
      ({
        ...chain,
        insert: () => insertChain,
        update: () => ({ eq: () => noop }),
        upsert: () => ({ select: () => ({ data: empty }) }),
        delete: () => ({ eq: () => noop }),
      }) as unknown as ReturnType<SupabaseClient["from"]>,
    auth: { getSession: () => Promise.resolve({ data: { session: null }, error: null }) },
  } as unknown as SupabaseClient;
}

export function createServerSupabaseClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_KEY;
  if (!url || !key) {
    if (process.env.NODE_ENV === "development") {
      return createMockSupabaseClient();
    }
    throw new Error("SUPABASE_URL and SUPABASE_KEY must be set");
  }
  return createClient(url, key);
}
