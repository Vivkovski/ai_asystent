import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/server/auth";
import { runAsk } from "@/lib/server/orchestration/ask";
import type { AskRequest } from "@repo/shared";
import { OpenRouterError } from "@/lib/server/llm/openrouter";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await getCurrentContext(request);
  if ("response" in result) return result.response;
  const { context } = result;
  const { id: conversationId } = await params;
  let body: AskRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { code: "INVALID_BODY", message: "Invalid JSON body" },
      { status: 400 }
    );
  }
  const content = typeof body.content === "string" ? body.content.trim() : "";
  if (!content) {
    return NextResponse.json(
      { code: "VALIDATION_ERROR", message: "content is required" },
      { status: 400 }
    );
  }
  try {
    const response = await runAsk(
      context.tenantId,
      context.userId,
      conversationId,
      content
    );
    return NextResponse.json(response);
  } catch (err) {
    if (err instanceof OpenRouterError) {
      const status = err.statusCode ?? 502;
      const code =
        status === 401
          ? "LLM_AUTH_ERROR"
          : status === 402
            ? "LLM_QUOTA_ERROR"
            : "LLM_UNAVAILABLE";
      const message =
        status === 401
          ? "Błąd autoryzacji usługi LLM."
          : status === 402
            ? "Niewystarczające środki w usłudze LLM."
            : "Usługa LLM tymczasowo niedostępna. Spróbuj ponownie.";
      return NextResponse.json(
        { code, message },
        { status }
      );
    }
    return NextResponse.json(
      { code: "INTERNAL_ERROR", message: "Wystąpił błąd. Spróbuj ponownie." },
      { status: 500 }
    );
  }
}
