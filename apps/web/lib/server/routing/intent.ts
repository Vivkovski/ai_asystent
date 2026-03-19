/**
 * Intent classification. Delegates to LLM or returns default. Server-only.
 */

import { classifyIntent as llmClassifyIntent, type IntentLabel } from "../llm/openrouter";

export type { IntentLabel };

export async function classifyIntent(question: string): Promise<IntentLabel> {
  return llmClassifyIntent(question);
}
