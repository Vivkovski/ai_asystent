/**
 * Connector I/O types (align with @repo/shared). Server-only.
 */

import type { Fragment, SourceMetadata } from "@repo/shared";

export type { Fragment, SourceMetadata };

export interface ConnectorOutput {
  success: boolean;
  fragments: Fragment[];
  source_metadata: SourceMetadata;
  error: string | null;
}

export interface ConnectorLimits {
  max_fragments_per_source: number;
  max_total_fragments: number;
  timeout_seconds: number;
}

export const DEFAULT_LIMITS: ConnectorLimits = {
  max_fragments_per_source: 20,
  max_total_fragments: 50,
  timeout_seconds: 30,
};

export interface ConnectorInput {
  query_text: string;
  config: Record<string, unknown>;
  limits: ConnectorLimits;
}

export interface ConnectorAdapter {
  fetch(input: ConnectorInput): Promise<ConnectorOutput>;
  testConnection(config: Record<string, unknown>): Promise<{ ok: boolean; error?: string }>;
}
