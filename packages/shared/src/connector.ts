/**
 * Connector contract types.
 * Used by apps/api (orchestration/runner) and packages/connectors (adapters).
 */

/** One text fragment from a source (e.g. one deal, one file snippet). */
export interface Fragment {
  content: string;
  metadata?: Record<string, unknown>;
}

/** Metadata for one connector call (one source). Shown in UI as one "source" with title/link. */
export interface SourceMetadata {
  source_id: string;
  type: string;
  title: string;
  link: string | null;
}

/** Output of a single connector fetch. */
export interface ConnectorOutput {
  success: boolean;
  fragments: Fragment[];
  source_metadata: SourceMetadata;
  error: string | null;
}
