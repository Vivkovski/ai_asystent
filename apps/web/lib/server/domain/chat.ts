/**
 * Conversations and messages persistence. Tenant- and user-scoped.
 */

import { createServerSupabaseClient } from "../supabase-admin";

function serialize<T extends Record<string, unknown>>(row: T): T {
  const d = { ...row } as Record<string, unknown>;
  for (const k of Object.keys(d)) {
    const v = d[k];
    if (v instanceof Date) d[k] = v.toISOString();
    else if (typeof v === "object" && v !== null && "toISOString" in v && typeof (v as Date).toISOString === "function")
      d[k] = (v as Date).toISOString();
  }
  return d as T;
}

export async function createConversation(
  tenantId: string,
  userId: string,
  title?: string | null
): Promise<Record<string, unknown>> {
  const supabase = createServerSupabaseClient();
  const now = new Date().toISOString().replace("+00:00", "Z");
  const { data, error } = await supabase
    .from("conversations")
    .insert({
      tenant_id: tenantId,
      user_id: userId,
      title: title ?? null,
      updated_at: now,
    })
    .select()
    .single();
  if (error || !data) {
    const e = error as
      | { message?: string; details?: string; hint?: string; code?: string }
      | null
      | undefined;
    const detail = [e?.message, e?.details, e?.hint, e?.code]
      .filter((x) => typeof x === "string" && x.trim().length > 0)
      .join(" | ");
    const msg = detail || (error ? JSON.stringify(error) : "no row returned (check grants / RLS)");
    console.error("[chat] createConversation failed:", msg, { data: data ?? null });
    throw new Error(msg);
  }
  return serialize(data as Record<string, unknown>);
}

export async function getConversation(
  tenantId: string,
  userId: string,
  conversationId: string
): Promise<Record<string, unknown> | null> {
  const supabase = createServerSupabaseClient();
  const { data } = await supabase
    .from("conversations")
    .select("*")
    .eq("id", conversationId)
    .eq("tenant_id", tenantId)
    .eq("user_id", userId)
    .maybeSingle();
  return data ? serialize(data as Record<string, unknown>) : null;
}

export async function listConversations(
  tenantId: string,
  userId: string,
  limit = 50
): Promise<Record<string, unknown>[]> {
  const supabase = createServerSupabaseClient();
  const { data } = await supabase
    .from("conversations")
    .select("id, title, created_at, updated_at")
    .eq("tenant_id", tenantId)
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(limit);
  return (data ?? []).map((row) => serialize(row as Record<string, unknown>));
}

export async function createMessage(
  conversationId: string,
  role: string,
  content: string,
  status = "pending"
): Promise<Record<string, unknown>> {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversationId,
      role,
      content,
      status,
    })
    .select()
    .single();
  if (error || !data) {
    const e = error as { message?: string; details?: string; hint?: string; code?: string } | null;
    const detail = [e?.message, e?.details, e?.hint, e?.code]
      .filter((x) => typeof x === "string" && x.trim().length > 0)
      .join(" | ");
    throw new Error(detail || "Insert message failed");
  }
  return serialize(data as Record<string, unknown>);
}

export async function updateMessage(
  messageId: string,
  updates: { content?: string; status?: string }
): Promise<void> {
  const supabase = createServerSupabaseClient();
  const obj: Record<string, string> = {};
  if (updates.content !== undefined) obj.content = updates.content;
  if (updates.status !== undefined) obj.status = updates.status;
  if (Object.keys(obj).length === 0) return;
  await supabase.from("messages").update(obj).eq("id", messageId);
}

export async function getMessages(
  conversationId: string
): Promise<Record<string, unknown>[]> {
  const supabase = createServerSupabaseClient();
  const { data } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });
  return (data ?? []).map((row) => serialize(row as Record<string, unknown>));
}

export async function insertAnswerSources(
  messageId: string,
  sources: { type?: string; title?: string; link?: string | null; fragment_count?: number }[]
): Promise<void> {
  if (sources.length === 0) return;
  const supabase = createServerSupabaseClient();
  const rows = sources.map((s) => ({
    message_id: messageId,
    source_type: s.type ?? "unknown",
    title: s.title ?? "",
    link: s.link ?? null,
    fragment_count: s.fragment_count ?? 0,
  }));
  await supabase.from("answer_sources").insert(rows);
}
