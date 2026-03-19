import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/server/auth";
import { requireAdmin } from "@/lib/server/auth-admin";
import * as integrationsDomain from "@/lib/server/domain/integrations";

export async function GET(request: NextRequest) {
  const result = await getCurrentContext(request);
  if ("response" in result) return result.response;
  const { context } = result;
  const forbidden = requireAdmin(context);
  if (forbidden) return forbidden.response;
  const items = await integrationsDomain.listIntegrations(context.tenantId);
  return NextResponse.json({ items }, {
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
      Pragma: "no-cache",
    },
  });
}

export async function POST(request: NextRequest) {
  const result = await getCurrentContext(request);
  if ("response" in result) return result.response;
  const { context } = result;
  const forbidden = requireAdmin(context);
  if (forbidden) return forbidden.response;
  let body: { type: string; credentials: Record<string, unknown>; display_name?: string };
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
  const out = await integrationsDomain.createIntegration(
    context.tenantId,
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
