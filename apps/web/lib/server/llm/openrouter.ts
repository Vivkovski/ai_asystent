/**
 * OpenRouter LLM client: intent classification and answer synthesis. Server-only.
 */

import {
  INTENT_CLASSIFICATION_PROMPT,
  ANSWER_SYNTHESIS_PROMPT,
} from "./prompts";

const OPENROUTER_BASE = "https://openrouter.ai/api/v1";
const VALID_INTENTS = ["crm", "documents", "spreadsheets", "mixed"] as const;
const DEFAULT_INTENT = "crm";
const MAX_TOKENS_INTENT = 10;
const MAX_TOKENS_SYNTHESIS = 2048;
const TIMEOUT_MS = 60_000;

export type IntentLabel = (typeof VALID_INTENTS)[number];

export interface SynthesisResult {
  answer: string;
  cited_indices: number[];
}

export class OpenRouterError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public requestId?: string
  ) {
    super(message);
    this.name = "OpenRouterError";
  }
}

async function chat(
  apiKey: string,
  model: string,
  messages: { role: string; content: string }[],
  maxTokens: number
): Promise<string> {
  const res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://github.com/flixhome-asystent",
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: maxTokens,
      temperature: 0.2,
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const requestId =
    res.headers.get("x-request-id") ?? res.headers.get("openrouter-request-id") ?? undefined;
  if (res.status === 401) {
    throw new OpenRouterError("OpenRouter authentication failed", 401, requestId);
  }
  if (res.status === 402) {
    throw new OpenRouterError("OpenRouter insufficient credits", 402, requestId);
  }
  if (!res.ok) {
    throw new OpenRouterError(
      `OpenRouter API error: ${res.status}`,
      res.status,
      requestId
    );
  }
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = data.choices?.[0]?.message?.content;
  if (content == null) {
    throw new OpenRouterError("OpenRouter response missing message content", undefined, requestId);
  }
  return typeof content === "string" ? content.trim() : String(content).trim();
}

export function classifyIntent(question: string): Promise<IntentLabel> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = process.env.OPENROUTER_MODEL ?? "openai/gpt-4o-mini";
  if (!apiKey) {
    return Promise.resolve(DEFAULT_INTENT as IntentLabel);
  }
  const messages = [
    { role: "system", content: INTENT_CLASSIFICATION_PROMPT },
    { role: "user", content: question },
  ];
  return chat(apiKey, model, messages, MAX_TOKENS_INTENT).then((raw) => {
    const label = raw.split(/\s/)[0]?.toLowerCase().trim() ?? "";
    for (const intent of VALID_INTENTS) {
      if (label === intent || label.includes(intent)) return intent;
    }
    return DEFAULT_INTENT as IntentLabel;
  });
}

export function synthesizeAnswer(
  question: string,
  fragmentsWithLabels: [string, string][]
): Promise<SynthesisResult> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = process.env.OPENROUTER_MODEL ?? "openai/gpt-4o-mini";
  if (!apiKey || fragmentsWithLabels.length === 0) {
    return Promise.resolve({
      answer: "Brak fragmentów do odpowiedzi.",
      cited_indices: [1],
    });
  }
  const parts = fragmentsWithLabels.map(([label, text]) => `${label} ${text}`);
  const userContent = `Question: ${question}\n\nFragments:\n${parts.join("\n\n")}`;
  const messages = [
    { role: "system", content: ANSWER_SYNTHESIS_PROMPT },
    { role: "user", content: userContent },
  ];
  return chat(apiKey, model, messages, MAX_TOKENS_SYNTHESIS).then((answer) => {
    const indices: number[] = [];
    const re = /\[(\d+)\]/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(answer)) !== null) {
      const idx = parseInt(m[1]!, 10);
      if (idx >= 1 && idx <= fragmentsWithLabels.length && !indices.includes(idx)) {
        indices.push(idx);
      }
    }
    if (indices.length === 0) indices.push(1);
    return { answer, cited_indices: indices };
  });
}
