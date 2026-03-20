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

  const tenantItems = await integrationsDomain.listIntegrations(context.tenantId);
  const userItems = await integrationsDomain.listUserIntegrations(
    context.tenantId,
    context.userId
  );

  const tenantByType = new Map(tenantItems.map((i) => [String(i.type), i]));
  const userByType = new Map(userItems.map((i) => [String(i.type), i]));

  const TYPES = ["bitrix", "google_drive", "google_sheets"] as const;
  const items = TYPES.flatMap((type) => {
    const tenant = tenantByType.get(type);
    const user = userByType.get(type);
    if (!tenant && !user) return [];
    if (tenant?.enabled === true) return [tenant];
    if (user) return [user];
    return tenant ? [tenant] : [];
  });

  return NextResponse.json({ items, tenant_items: tenantItems, user_items: userItems });
}

export async function POST(request: NextRequest) {
  const result = await getCurrentContext(request);
  if ("response" in result) return result.response;
  const { context } = result;

  let body: {
    type?: string;
    credentials?: Record<string, unknown>;
    display_name?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { code: "INVALID_BODY", message: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const { type, credentials, display_name } = body;
  if (!type || !credentials || typeof credentials !== "object") {
    return NextResponse.json(
      { code: "VALIDATION_ERROR", message: "type and credentials required" },
      { status: 400 }
    );
  }

  const out = await integrationsDomain.createUserIntegration(
    context.tenantId,
    context.userId,
    type,
    credentials,
    display_name ?? null
  );

  if ("error" in out) {
    const status = out.error === "Invalid type" ? 400 : 422;
    return NextResponse.json(
      { code: "INTEGRATION_ERROR", message: out.error },
      { status }
    );
  }

  return NextResponse.json(out.row);
}
