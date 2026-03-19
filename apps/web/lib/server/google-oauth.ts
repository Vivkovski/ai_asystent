/**
 * Google OAuth state store (in-memory, TTL). For multi-instance use Redis or signed cookie.
 */

const STATE_TTL_MS = 600_000; // 10 min
const stateMap = new Map<string, number>();

export function setState(state: string): void {
  prune();
  stateMap.set(state, Date.now());
}

export function consumeState(state: string): boolean {
  const created = stateMap.get(state);
  if (created == null) return false;
  if (Date.now() - created > STATE_TTL_MS) {
    stateMap.delete(state);
    return false;
  }
  stateMap.delete(state);
  return true;
}

function prune(): void {
  const now = Date.now();
  for (const [s, t] of stateMap.entries()) {
    if (now - t > STATE_TTL_MS) stateMap.delete(s);
  }
}
