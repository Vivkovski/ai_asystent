import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/server/auth";

export async function GET(request: NextRequest) {
  const result = await getCurrentContext(request);
  if ("response" in result) return result.response;
  const { context } = result;
  return NextResponse.json({
    tenant_id: context.tenantId,
    user_id: context.userId,
    role: context.role,
  });
}
