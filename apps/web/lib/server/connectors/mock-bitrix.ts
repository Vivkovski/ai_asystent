/**
 * Mock Bitrix adapter for development and tests.
 */

import type {
  ConnectorInput,
  ConnectorOutput,
  Fragment,
  SourceMetadata,
} from "./contract";

export class MockBitrixAdapter {
  async fetch(input: ConnectorInput): Promise<ConnectorOutput> {
    const n = Math.min(3, input.limits.max_fragments_per_source);
    const fragments: Fragment[] = [];
    for (let i = 0; i < n; i++) {
      fragments.push({
        content: `Mock Bitrix fragment ${i + 1} for: ${input.query_text.slice(0, 50)}...`,
      });
    }
    return {
      success: true,
      fragments,
      source_metadata: {
        source_id: "bitrix",
        type: "crm",
        title: "Bitrix (mock)",
        link: null,
      },
      error: null,
    };
  }

  async testConnection(): Promise<{ ok: boolean; error?: string }> {
    return { ok: true };
  }
}
