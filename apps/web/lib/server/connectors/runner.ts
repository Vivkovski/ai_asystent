/**
 * Parallel connector invocation with timeout and limits. Server-only.
 */

import {
  type ConnectorInput,
  type ConnectorOutput,
  DEFAULT_LIMITS,
  type ConnectorLimits,
} from "./contract";
import { getAdapter } from "./registry";
import { loadConfig } from "../domain/integrations";

function errorMetadata(sourceId: string): ConnectorOutput["source_metadata"] {
  return {
    source_id: sourceId,
    type: "unknown",
    title: sourceId,
    link: null,
  };
}

export async function fetchOne(
  sourceId: string,
  tenantId: string,
  userId: string,
  queryText: string,
  limits: ConnectorLimits = DEFAULT_LIMITS
): Promise<ConnectorOutput> {
  const adapter = getAdapter(sourceId);
  if (!adapter) {
    return {
      success: false,
      fragments: [],
      source_metadata: errorMetadata(sourceId),
      error: "Adapter not found",
    };
  }
  const config = await loadConfig(tenantId, userId, sourceId);
  if (!config) {
    return {
      success: false,
      fragments: [],
      source_metadata: errorMetadata(sourceId),
      error: "Integration not configured or disabled",
    };
  }
  const input: ConnectorInput = {
    query_text: queryText,
    config: config,
    limits,
  };
  try {
    const timeoutMs = limits.timeout_seconds * 1000;
    const out = await Promise.race([
      adapter.fetch(input),
      new Promise<ConnectorOutput>((_, reject) =>
        setTimeout(() => reject(new Error("Timeout")), timeoutMs)
      ),
    ]);
    return out;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      fragments: [],
      source_metadata: errorMetadata(sourceId),
      error: msg.slice(0, 200),
    };
  }
}

export async function fetchAll(
  sourceIds: string[],
  tenantId: string,
  userId: string,
  queryText: string,
  limits: ConnectorLimits = DEFAULT_LIMITS
): Promise<ConnectorOutput[]> {
  const results = await Promise.all(
    sourceIds.map((id) => fetchOne(id, tenantId, userId, queryText, limits))
  );
  return results;
}
