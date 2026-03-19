/**
 * Adapter registry: source_id -> adapter. No connector-specific logic. Server-only.
 */

import type { ConnectorAdapter } from "./contract";
import { MockBitrixAdapter } from "./mock-bitrix";
import { GoogleDriveAdapter } from "./google-drive";

const adapters = new Map<string, ConnectorAdapter>();

export function register(sourceId: string, adapter: ConnectorAdapter): void {
  adapters.set(sourceId, adapter);
}

export function getAdapter(sourceId: string): ConnectorAdapter | null {
  if (!registered) registerAdapters();
  return adapters.get(sourceId) ?? null;
}

let registered = false;

export function registerAdapters(): void {
  if (registered) return;
  registered = true;
  register("bitrix", new MockBitrixAdapter());
  const driveAdapter = new GoogleDriveAdapter();
  register("google_drive", driveAdapter);
  register("google_sheets", driveAdapter);
}
