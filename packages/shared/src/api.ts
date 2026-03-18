/**
 * API request/response shapes for ask flow and chat.
 * Used by apps/web (client) and apps/api (response DTOs).
 */

/** Single source item in API response (for [1],[2] and sources list). */
export interface SourceItem {
  id: number;
  type: string;
  title: string;
  link: string | null;
  unavailable?: boolean;
}

/** Message status after ask. */
export type MessageStatus = "pending" | "completed" | "partial" | "failed";

/** Request body for POST /conversations/:id/messages (ask). */
export interface AskRequest {
  content: string;
}

/** Assistant message + sources in response. */
export interface AskResponseMessage {
  id: string;
  role: "assistant";
  content: string;
  answer: string;
  sources: SourceItem[];
  status: MessageStatus;
  created_at: string;
}

/** Response for ask endpoint. */
export interface AskResponse {
  message: AskResponseMessage;
  /** Optional warning when status is partial (e.g. "Bitrix temporarily unavailable"). */
  warning?: string;
}

/** Conversation list item. */
export interface ConversationListItem {
  id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
}

/** Message in conversation (for GET conversation). */
export interface MessageInConversation {
  id: string;
  role: "user" | "assistant";
  content: string;
  status?: MessageStatus;
  sources?: SourceItem[];
  created_at: string;
}
