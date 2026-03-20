/**
 * Intent -> source_ids, filtered by tenant enabled integrations. Server-only.
 */

import { INTENT_TO_SOURCES, type IntentLabel } from "@repo/shared";
import { createServerSupabaseClient } from "../supabase-admin";

export async function getSourcesForIntent(
  tenantId: string,
  userId: string,
  intentLabel: string
): Promise<string[]> {
  const sourceIds = INTENT_TO_SOURCES[intentLabel as IntentLabel];
  if (!sourceIds || sourceIds.length === 0) return [];
  const hasServerSupabaseKey =
    !!process.env.SUPABASE_KEY || !!process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!process.env.SUPABASE_URL || !hasServerSupabaseKey) return [];
  const supabase = createServerSupabaseClient();
  const [tenantRes, userRes] = await Promise.all([
    supabase
      .from("integrations")
      .select("type")
      .eq("tenant_id", tenantId)
      .eq("enabled", true)
      .in("type", [...sourceIds]),
    supabase
      .from("user_integrations")
      .select("type")
      .eq("tenant_id", tenantId)
      .eq("user_id", userId)
      .eq("enabled", true)
      .in("type", [...sourceIds]),
  ]);

  const tenantEnabledTypes = new Set((tenantRes.data ?? []).map((r) => r.type as string));
  const userEnabledTypes = new Set((userRes.data ?? []).map((r) => r.type as string));

  // Tenant has priority: if tenant integration is enabled, it wins regardless of user overrides.
  return sourceIds.filter((id) => tenantEnabledTypes.has(id) || userEnabledTypes.has(id));
}
