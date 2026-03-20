import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/server/auth";
import * as integrationsDomain from "@/lib/server/domain/integrations";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await getCurrentContext(request);
  if ("response" in result) return result.response;
  const { context } = result;

  const { id } = await params;
  const row = await integrationsDomain.getUserIntegration(
    context.tenantId,
    context.userId,
    id
  );

  if (!row) {
    return NextResponse.json({ detail: "Not found" }, { status: 404 });
  }
  return NextResponse.json(row);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await getCurrentContext(request);
  if ("response" in result) return result.response;
  const { context } = result;

  const { id } = await params;

  let body: { credentials?: Record<string, unknown>; enabled?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { code: "INVALID_BODY", message: "Invalid JSON body" },
      { status: 400 }
    );
  }

  if (
    body.credentials !== undefined &&
    (body.credentials === null || typeof body.credentials !== "object")
  ) {
    return NextResponse.json(
      { code: "VALIDATION_ERROR", message: "credentials must be an object" },
      { status: 400 }
    );
  }

  if (body.enabled !== undefined && typeof body.enabled !== "boolean") {
    return NextResponse.json(
      { code: "VALIDATION_ERROR", message: "enabled must be boolean" },
      { status: 400 }
    );
  }

  const out = await integrationsDomain.updateUserIntegration(
    context.tenantId,
    context.userId,
    id,
    { credentials: body.credentials, enabled: body.enabled }
  );

  if ("error" in out) {
    const status = out.error === "Not found" ? 404 : 422;
    return NextResponse.json(
      { code: "INTEGRATION_ERROR", message: out.error },
      { status }
    );
  }

  return NextResponse.json(out.row);
}

