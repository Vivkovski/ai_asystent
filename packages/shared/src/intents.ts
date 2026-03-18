/**
 * Intent taxonomy for source routing.
 * Used by API for intent classification and intent→source mapping.
 */

export const INTENT_LABELS = ["crm", "documents", "spreadsheets", "mixed"] as const;
export type IntentLabel = (typeof INTENT_LABELS)[number];

export const SOURCE_IDS = ["bitrix", "google_drive", "google_sheets"] as const;
export type SourceId = (typeof SOURCE_IDS)[number];

/** Platform mapping: intent → ordered source ids (filtered by tenant integrations in API). */
export const INTENT_TO_SOURCES: Record<IntentLabel, readonly SourceId[]> = {
  crm: ["bitrix"],
  documents: ["google_drive"],
  spreadsheets: ["google_sheets"],
  mixed: ["bitrix", "google_drive", "google_sheets"],
};
