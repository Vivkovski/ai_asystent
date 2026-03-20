/**
 * Full ask pipeline: resolve conversation -> user message -> intent -> sources -> fetch -> synthesis -> persist -> audit -> response.
 */

import type { AskResponse, SourceItem, MessageStatus } from "@repo/shared";
import * as chatDomain from "../domain/chat";
import { logAudit } from "../domain/audit";
import { classifyIntent } from "../routing/intent";
import { getSourcesForIntent } from "../routing/sourceSelector";
import { fetchAll } from "../connectors/runner";
import { synthesizeAnswer } from "../llm/openrouter";
import { DEFAULT_LIMITS } from "../connectors/contract";

export async function runAsk(
  tenantId: string,
  userId: string,
  conversationId: string | null,
  content: string
): Promise<AskResponse> {
  let conv = conversationId
    ? await chatDomain.getConversation(tenantId, userId, conversationId)
    : null;
  if (!conv) {
    conv = await chatDomain.createConversation(tenantId, userId);
    conversationId = String(conv.id);
  }

  const userMsg = await chatDomain.createMessage(
    conversationId as string,
    "user",
    content,
    "pending"
  );
  const userMsgId = String(userMsg.id);

  const intent = await classifyIntent(content);
  const sourceIds = await getSourcesForIntent(tenantId, userId, intent);

  if (sourceIds.length === 0) {
    await chatDomain.updateMessage(userMsgId, { status: "failed" });
    const assistantMsg = await chatDomain.createMessage(
      conversationId as string,
      "assistant",
      "Brak podłączonych źródeł dla tego typu zapytania. Skonfiguruj integracje w panelu admin.",
      "completed"
    );
    return response(assistantMsg, [], null);
  }

  const outputs = await fetchAll(sourceIds, tenantId, userId, content, DEFAULT_LIMITS);
  const allFragments: [string, string][] = [];
  let idx = 1;
  for (const out of outputs) {
    const label = `[${idx}]`;
    for (const f of out.fragments) {
      allFragments.push([label, f.content]);
    }
    idx++;
  }

  if (allFragments.length === 0) {
    await chatDomain.updateMessage(userMsgId, { status: "failed" });
    const assistantMsg = await chatDomain.createMessage(
      conversationId as string,
      "assistant",
      "Nie udało się pobrać danych z wybranych źródeł. Spróbuj ponownie lub sprawdź integracje.",
      "failed"
    );
    return response(assistantMsg, [], "Jedno lub więcej źródeł niedostępne.");
  }

  const result = await synthesizeAnswer(content, allFragments);
  const answer = result.answer;
  const sourcesForResponse: SourceItem[] = outputs.map((out, i) => ({
    id: i + 1,
    type: out.source_metadata.type,
    title: out.source_metadata.title,
    link: out.source_metadata.link,
    unavailable: !outputs[i]!.success,
  }));

  const status = outputs.some((o) => !o.success) ? "partial" : "completed";
  const assistantMsg = await chatDomain.createMessage(
    conversationId as string,
    "assistant",
    answer,
    status
  );
  const assistantMsgId = String(assistantMsg.id);

  await chatDomain.insertAnswerSources(
    assistantMsgId,
    outputs.map((out) => ({
      type: out.source_metadata.type,
      title: out.source_metadata.title,
      link: out.source_metadata.link,
      fragment_count: out.fragments.length,
    }))
  );

  try {
    await logAudit(tenantId, userId, "message_created", "message", assistantMsgId, {
      sources_used: sourceIds,
      status,
    });
  } catch {
    // ignore audit errors
  }

  const warning =
    status === "partial" ? "Jedno lub więcej źródeł tymczasowo niedostępne." : null;
  return response(assistantMsg, sourcesForResponse, warning);
}

function response(
  assistantMsg: Record<string, unknown>,
  sources: SourceItem[],
  warning: string | null
): AskResponse {
  return {
    message: {
      id: String(assistantMsg.id),
      role: "assistant",
      content: String(assistantMsg.content),
      answer: String(assistantMsg.content),
      sources,
      status: ((assistantMsg.status as string) ?? "completed") as MessageStatus,
      created_at: String(assistantMsg.created_at),
    },
    warning: warning ?? undefined,
  };
}
