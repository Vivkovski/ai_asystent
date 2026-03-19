import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/server/auth";
import * as chatDomain from "@/lib/server/domain/chat";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await getCurrentContext(request);
  if ("response" in result) return result.response;
  const { context } = result;
  const { id } = await params;
  const conv = await chatDomain.getConversation(
    context.tenantId,
    context.userId,
    id
  );
  if (!conv) {
    if (context.tenantId === "mock-tenant") {
      const stub = {
        id,
        title: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        messages: [] as Record<string, unknown>[],
      };
      return NextResponse.json(stub);
    }
    return NextResponse.json({ detail: "Not found" }, { status: 404 });
  }
  const messages = await chatDomain.getMessages(id);
  return NextResponse.json({ ...conv, messages });
}
