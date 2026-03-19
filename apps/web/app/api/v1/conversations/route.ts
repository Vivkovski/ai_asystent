import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/server/auth";
import * as chatDomain from "@/lib/server/domain/chat";

export async function GET(request: NextRequest) {
  const result = await getCurrentContext(request);
  if ("response" in result) return result.response;
  const { context } = result;
  const limit = Math.min(
    parseInt(request.nextUrl.searchParams.get("limit") ?? "50", 10) || 50,
    100
  );
  const items = await chatDomain.listConversations(
    context.tenantId,
    context.userId,
    limit
  );
  return NextResponse.json({ items });
}

export async function POST(request: NextRequest) {
  const result = await getCurrentContext(request);
  if ("response" in result) return result.response;
  const { context } = result;
  let body: { title?: string } = {};
  try {
    body = await request.json();
  } catch {
    // optional body
  }
  try {
    const conv = await chatDomain.createConversation(
      context.tenantId,
      context.userId,
      body.title ?? null
    );
    return NextResponse.json(conv);
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Wystąpił błąd";
    console.error("[conversations POST]", detail, err);
    return NextResponse.json(
      {
        code: "INTERNAL_ERROR",
        message: "Nie udało się utworzyć rozmowy. Spróbuj ponownie.",
        detail,
      },
      { status: 500 }
    );
  }
}
