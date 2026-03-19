import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/server/auth";
import * as integrationsDomain from "@/lib/server/domain/integrations";

/**
 * GET /api/v1/integrations — lista integracji tenanta (read-only).
 * Dostępne dla każdego zalogowanego użytkownika (do wyświetlania w czacie).
 */
export async function GET(request: NextRequest) {
  const result = await getCurrentContext(request);
  if ("response" in result) return result.response;
  const { context } = result;
  const items = await integrationsDomain.listIntegrations(context.tenantId);
  return NextResponse.json({ items });
}
