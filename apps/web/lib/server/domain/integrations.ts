/**
 * Integrations: load config for runner; list/create/update for admin. Never return raw credentials.
 */

import { createServerSupabaseClient } from "../supabase-admin";
import { decrypt, encrypt } from "../encryption";
import { getAdapter } from "../connectors/registry";

function serialize<T extends Record<string, unknown>>(row: T): Record<string, unknown> {
  const d: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (v instanceof Date) d[k] = v.toISOString();
    else if (v && typeof v === "object" && "toISOString" in v && typeof (v as Date).toISOString === "function")
      d[k] = (v as Date).toISOString();
    else d[k] = v;
  }
  return d;
}

export async function loadConfig(
  tenantId: string,
  sourceId: string
): Promise<Record<string, unknown> | null> {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) return null;
  const supabase = createServerSupabaseClient();
  const { data } = await supabase
    .from("integrations")
    .select("credentials_encrypted, config, enabled")
    .eq("tenant_id", tenantId)
    .eq("type", sourceId)
    .maybeSingle();
  if (!data?.enabled) return null;
  const config = { ...(data.config as Record<string, unknown>) };
  const credsEnc = data.credentials_encrypted as string | null;
  if (credsEnc) {
    try {
      config._credentials = JSON.parse(decrypt(credsEnc)) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
  return config;
}

export async function listIntegrations(
  tenantId: string
): Promise<Record<string, unknown>[]> {
  const supabase = createServerSupabaseClient();
  const { data } = await supabase
    .from("integrations")
    .select("id, type, display_name, enabled, last_tested_at, last_error, created_at, updated_at")
    .eq("tenant_id", tenantId)
    .order("type");
  return (data ?? []).map((row) => serialize(row as Record<string, unknown>));
}

export async function createIntegration(
  tenantId: string,
  type: string,
  credentials: Record<string, unknown>,
  displayName?: string | null
): Promise<{ row: Record<string, unknown> } | { error: string }> {
  if (!["bitrix", "google_drive", "google_sheets"].includes(type)) {
    return { error: "Invalid type" };
  }
  const adapter = getAdapter(type);
  if (!adapter) return { error: "Connector not available" };
  const config = { _credentials: credentials };
  const test = await adapter.testConnection(config);
  if (!test.ok) return { error: test.error ?? "Test failed" };
  let credentialsEncrypted: string;
  try {
    credentialsEncrypted = encrypt(JSON.stringify(credentials));
  } catch {
    return { error: "Encryption failed" };
  }
  const supabase = createServerSupabaseClient();
  const now = new Date().toISOString().replace("+00:00", "Z");
  const { data, error } = await supabase
    .from("integrations")
    .upsert(
      {
        tenant_id: tenantId,
        type,
        display_name: displayName ?? type,
        enabled: true,
        credentials_encrypted: credentialsEncrypted,
        config: {},
        last_tested_at: now,
        last_error: null,
        updated_at: now,
      },
      { onConflict: "tenant_id,type" }
    )
    .select()
    .single();
  if (error || !data) return { error: "Insert failed" };
  const out = serialize(data as Record<string, unknown>);
  delete out.credentials_encrypted;
  delete out.config;
  return { row: out };
}

export async function updateIntegration(
  tenantId: string,
  integrationId: string,
  updates: { credentials?: Record<string, unknown>; enabled?: boolean }
): Promise<{ row: Record<string, unknown> } | { error: string }> {
  const supabase = createServerSupabaseClient();
  const { data: existing } = await supabase
    .from("integrations")
    .select("id, type")
    .eq("id", integrationId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (!existing) return { error: "Not found" };
  const rowUpdates: Record<string, unknown> = {};
  if (updates.credentials !== undefined) {
    const adapter = getAdapter(existing.type as string);
    if (!adapter) return { error: "Connector not available" };
    const test = await adapter.testConnection({ _credentials: updates.credentials });
    if (!test.ok) return { error: test.error ?? "Test failed" };
    try {
      rowUpdates.credentials_encrypted = encrypt(JSON.stringify(updates.credentials));
    } catch {
      return { error: "Encryption failed" };
    }
    rowUpdates.last_tested_at = new Date().toISOString().replace("+00:00", "Z");
    rowUpdates.last_error = null;
  }
  if (updates.enabled !== undefined) rowUpdates.enabled = updates.enabled;
  if (Object.keys(rowUpdates).length === 0) return { error: "Nothing to update" };
  rowUpdates.updated_at = new Date().toISOString().replace("+00:00", "Z");
  const { data, error } = await supabase
    .from("integrations")
    .update(rowUpdates)
    .eq("id", integrationId)
    .eq("tenant_id", tenantId)
    .select()
    .single();
  if (error || !data) return { error: "Update failed" };
  const out = serialize(data as Record<string, unknown>);
  delete out.credentials_encrypted;
  delete out.config;
  return { row: out };
}

export async function getIntegration(
  tenantId: string,
  integrationId: string
): Promise<Record<string, unknown> | null> {
  const supabase = createServerSupabaseClient();
  const { data } = await supabase
    .from("integrations")
    .select("id, type, display_name, enabled, last_tested_at, last_error, created_at, updated_at")
    .eq("id", integrationId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  return data ? serialize(data as Record<string, unknown>) : null;
}
