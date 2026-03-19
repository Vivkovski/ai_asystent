/**
 * Intent -> source_ids, filtered by tenant enabled integrations. Server-only.
 */

import { INTENT_TO_SOURCES, type IntentLabel } from "@repo/shared";
import { createServerSupabaseClient } from "../supabase-admin";

export async function getSourcesForIntent(
  tenantId: string,
  intentLabel: string
): Promise<string[]> {
  const sourceIds = INTENT_TO_SOURCES[intentLabel as IntentLabel];
  if (!sourceIds || sourceIds.length === 0) return [];
  const hasServerSupabaseKey =
    !!process.env.SUPABASE_KEY || !!process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!process.env.SUPABASE_URL || !hasServerSupabaseKey) return [];
  const supabase = createServerSupabaseClient();
  const { data } = await supabase
    .from("integrations")
    .select("type")
    .eq("tenant_id", tenantId)
    .eq("enabled", true)
    .in("type", [...sourceIds]);
  const enabledTypes = new Set((data ?? []).map((r) => r.type as string));
  return sourceIds.filter((id) => enabledTypes.has(id));
}
