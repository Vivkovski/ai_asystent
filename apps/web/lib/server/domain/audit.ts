/**
 * Append-only audit log. No full PII. Server-only.
 */

import { createServerSupabaseClient } from "../supabase-admin";

export async function logAudit(
  tenantId: string,
  userId: string | null,
  action: string,
  resourceType?: string | null,
  resourceId?: string | null,
  metadata?: Record<string, unknown> | null
): Promise<void> {
  const supabase = createServerSupabaseClient();
  await supabase.from("audit_logs").insert({
    tenant_id: tenantId,
    user_id: userId,
    action,
    resource_type: resourceType ?? null,
    resource_id: resourceId ?? null,
    metadata: metadata ?? {},
  });
}
