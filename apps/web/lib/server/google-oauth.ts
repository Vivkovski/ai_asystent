/**
 * Google OAuth `state` handling.
 *
 * Historically we used an in-memory TTL Map. That breaks in multi-instance/serverless
 * deployments (callback may hit a different instance).
 *
 * Now we support signed state (HMAC) so callback can validate it without relying
 * on in-memory storage. If the signing secret is not configured we fall back to
 * the in-memory Map for local/dev compatibility.
 */

import { createHmac, timingSafeEqual } from "crypto";

const STATE_TTL_MS = 600_000; // 10 min
const stateMap = new Map<string, number>();

function getStateSecret(): string | null {
  // Dedicated secret is preferred; fallback to ENCRYPTION_KEY (already required for app)
  // to avoid additional env requirements.
  const secret = process.env.GOOGLE_OAUTH_STATE_SECRET ?? process.env.ENCRYPTION_KEY;
  if (!secret || secret.length < 16) return null;
  return secret;
}

function isSignedStateFormat(state: string): state is `${string}.${string}.${string}` {
  // base64url(HMAC) never contains dots, so we can safely split into 3 parts.
  const parts = state.split(".");
  return parts.length === 3 && parts[1].length > 0 && parts[2].length > 0;
}

export function createState(): string {
  const id = crypto.randomUUID().replace(/-/g, "");
  const ts = Date.now().toString();
  const secret = getStateSecret();

  // If secret isn't configured, keep old behavior (in-memory TTL Map).
  if (!secret) {
    const state = id;
    setState(state);
    return state;
  }

  const sig = createHmac("sha256", secret).update(`${id}.${ts}`).digest("base64url");
  const state = `${id}.${ts}.${sig}`;
  setState(state);
  return state;
}

export function setState(state: string): void {
  prune();
  stateMap.set(state, Date.now());
}

export function consumeState(state: string): boolean {
  const secret = getStateSecret();

  // Preferred: validate signed state without relying on in-memory storage.
  if (secret && isSignedStateFormat(state)) {
    const [id, tsStr, sig] = state.split(".");
    const createdAt = Number(tsStr);
    if (!Number.isFinite(createdAt)) return false;
    if (Date.now() - createdAt > STATE_TTL_MS) return false;

    const expectedSig = createHmac("sha256", secret).update(`${id}.${tsStr}`).digest("base64url");

    // timingSafeEqual requires same length
    const a = Buffer.from(sig);
    const b = Buffer.from(expectedSig);
    if (a.length !== b.length) return false;

    if (!timingSafeEqual(a, b)) return false;

    // Best-effort "consume": if we happen to run on the same instance that called setState(),
    // prevent replay within TTL.
    stateMap.delete(state);
    return true;
  }

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
