/**
 * Full ask pipeline: resolve conversation -> user message -> intent -> sources -> fetch -> synthesis -> persist -> audit -> response.
 */

import type { AskResponse, SourceItem, MessageStatus } from "@repo/shared";
import * as chatDomain from "../domain/chat";
import * as integrationsDomain from "../domain/integrations";
import { logAudit } from "../domain/audit";
import { classifyIntent } from "../routing/intent";
import { getSourcesForIntent } from "../routing/sourceSelector";
import { fetchAll } from "../connectors/runner";
import { synthesizeAnswer } from "../llm/openrouter";
import { DEFAULT_LIMITS } from "../connectors/contract";

function toConversationTitle(input: string): string {
  const oneLine = input.replace(/\s+/g, " ").trim();
  if (!oneLine) return "";
  const maxLen = 80;
  if (oneLine.length <= maxLen) return oneLine;
  return `${oneLine.slice(0, maxLen)}...`;
}

function isBitrixConnectionQuestion(question: string): boolean {
  const q = question.toLowerCase();
  const hasBitrix = q.includes("bitrix");
  const hasConnectionSignal =
    q.includes("połączen") ||
    q.includes("polaczen") ||
    q.includes("połącz") ||
    q.includes("connected") ||
    q.includes("działa") ||
    q.includes("dzial") ||
    q.includes("status") ||
    q.includes("włącz") ||
    q.includes("integracj");
  return hasBitrix && hasConnectionSignal;
}

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

  // Ensure sidebar title is always based on the first user message (not a static fallback).
  const currentTitle = conv && (conv as Record<string, unknown>).title;
  const hasMeaningfulTitle =
    typeof currentTitle === "string" && currentTitle.trim().length > 0;
  if (!hasMeaningfulTitle) {
    const convId = conversationId as string;
    const firstUser = await chatDomain.getFirstUserMessage(convId);
    const raw = firstUser?.content ?? content;
    const candidate = toConversationTitle(raw);
    if (candidate) {
      await chatDomain.updateConversationTitle(convId, candidate);
    }
  }

  // Special-case: connection/health questions should not rely on LLM + mock fragments.
  // We answer deterministically from the integration status stored in Supabase.
  if (isBitrixConnectionQuestion(content)) {
    const [tenantItems, userItems] = await Promise.all([
      integrationsDomain.listIntegrations(tenantId),
      integrationsDomain.listUserIntegrations(tenantId, userId),
    ]);

    const tenantBitrix = tenantItems.find((i) => String(i.type) === "bitrix");
    const userBitrix = userItems.find((i) => String(i.type) === "bitrix");

    const chosen =
      tenantBitrix?.enabled === true
        ? tenantBitrix
        : userBitrix?.enabled === true
          ? userBitrix
          : null;

    let answer = "";
    if (chosen) {
      const lastTestedAt = chosen.last_tested_at
        ? String(chosen.last_tested_at)
        : "brak";
      const lastError = chosen.last_error ? String(chosen.last_error) : null;
      if (lastError) {
        answer = `Masz włączoną integrację Bitrix24, ale ostatni test nie powiódł się: ${lastError} (ostatni test: ${lastTestedAt}).`;
      } else {
        answer = `Masz włączoną integrację Bitrix24. Ostatni test: ${lastTestedAt}.`;
      }
    } else {
      answer =
        "Brak włączonej integracji Bitrix24. Dodaj integrację w panelu admin i wykonaj test połączenia.";
    }

    const assistantMsg = await chatDomain.createMessage(
      conversationId as string,
      "assistant",
      answer,
      "completed"
    );

    const sourcesForResponse: SourceItem[] = [
      { id: 1, type: "crm", title: "Bitrix24", link: null, unavailable: false },
    ];

    await chatDomain.insertAnswerSources(String(assistantMsg.id), [
      {
        type: "crm",
        title: "Bitrix24",
        link: null,
        fragment_count: chosen ? 1 : 0,
      },
    ]);

    try {
      await logAudit(tenantId, userId, "message_created", "message", String(assistantMsg.id), {
        sources_used: ["bitrix"],
        status: "completed",
      });
    } catch {
      // ignore audit errors
    }

    // Keep user message status unchanged; this branch always "completes" the assistant answer.
    return response(assistantMsg, sourcesForResponse, null);
  }

  const intent = await classifyIntent(content);
  let sourceIds = await getSourcesForIntent(tenantId, userId, intent);

  if (sourceIds.length === 0) {
    const [tenantItems, userItems] = await Promise.all([
      integrationsDomain.listIntegrations(tenantId),
      integrationsDomain.listUserIntegrations(tenantId, userId),
    ]);

    const enabledTypes = new Set<string>();
    for (const i of tenantItems) if (i.enabled === true && typeof i.type === "string") enabledTypes.add(i.type);
    for (const i of userItems) if (i.enabled === true && typeof i.type === "string") enabledTypes.add(i.type);

    const priority: string[] = ["bitrix", "google_drive", "google_sheets"];
    const fallback = priority.find((t) => enabledTypes.has(t));
    if (fallback) {
      sourceIds = [fallback];
    } else {
      await chatDomain.updateMessage(userMsgId, { status: "failed" });
      const assistantMsg = await chatDomain.createMessage(
        conversationId as string,
        "assistant",
        "Brak podłączonych źródeł dla tego typu zapytania. Skonfiguruj integracje w panelu admin.",
        "completed"
      );
      return response(assistantMsg, [], null);
    }
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
