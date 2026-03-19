/**
 * JWT validation and profile loading. Returns CurrentContext or 401 response.
 * Prefer ES256 (JWKS), fallback HS256 (Legacy Secret). Server-only.
 * W dev bez Supabase akceptowany jest token mock (MOCK_LOCAL_DEV_TOKEN).
 */

import * as jose from "jose";
import { NextRequest, NextResponse } from "next/server";
import { MOCK_LOCAL_DEV_TOKEN } from "@/lib/mock-auth";
import { createServerSupabaseClient } from "./supabase-admin";

async function secretToKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

export interface CurrentContext {
  tenantId: string;
  userId: string;
  role: "end_user" | "tenant_admin";
  isTenantAdmin: boolean;
}

type AuthResult =
  | { context: CurrentContext }
  | { response: NextResponse };

const AUTH_HEADER = "authorization";
const BEARER_PREFIX = "Bearer ";

async function fetchJwks(): Promise<jose.JSONWebKeySet> {
  const base = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key =
    process.env.SUPABASE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) throw new Error("SUPABASE_URL/SUPABASE_KEY not set");
  const res = await fetch(`${base}/auth/v1/.well-known/jwks.json`, {
    headers: { apikey: key },
  });
  if (!res.ok) throw new Error(`JWKS fetch failed: ${res.status}`);
  return (await res.json()) as jose.JSONWebKeySet;
}

async function verifyWithJwks(token: string): Promise<jose.JWTPayload | null> {
  try {
    const jwks = await fetchJwks();
    const set = jose.createLocalJWKSet(jwks);
    const { payload } = await jose.jwtVerify(token, set, {
      audience: "authenticated",
    });
    return payload;
  } catch {
    return null;
  }
}

async function verifyWithSecret(token: string): Promise<jose.JWTPayload | null> {
  const secret = process.env.SUPABASE_JWT_SECRET;
  if (!secret) return null;
  try {
    const key = await secretToKey(secret);
    const { payload } = await jose.jwtVerify(token, key, {
      audience: "authenticated",
    });
    return payload;
  } catch {
    return null;
  }
}

const MOCK_CONTEXT: CurrentContext = {
  tenantId: "mock-tenant",
  userId: "mock-user",
  role: "tenant_admin",
  isTenantAdmin: true,
};

export async function getCurrentContext(request: NextRequest): Promise<AuthResult> {
  const auth = request.headers.get(AUTH_HEADER);
  const token = auth?.startsWith(BEARER_PREFIX) ? auth.slice(BEARER_PREFIX.length).trim() : null;

  const authConfigured =
    !!process.env.SUPABASE_JWT_SECRET || !!process.env.SUPABASE_URL;

  if (token === MOCK_LOCAL_DEV_TOKEN && process.env.NODE_ENV === "development" && !authConfigured) {
    return { context: MOCK_CONTEXT };
  }

  if (!authConfigured) {
    return {
      response: NextResponse.json(
        { detail: "Auth not configured" },
        { status: 401 }
      ),
    };
  }

  if (!token) {
    return {
      response: NextResponse.json(
        { detail: "Missing or invalid authorization" },
        { status: 401 }
      ),
    };
  }

  let payload: jose.JWTPayload | null = null;
  if (process.env.SUPABASE_URL) {
    payload = await verifyWithJwks(token);
  }
  if (!payload && process.env.SUPABASE_JWT_SECRET) {
    payload = await verifyWithSecret(token);
  }
  if (!payload) {
    return {
      response: NextResponse.json(
        { detail: "Invalid or expired token" },
        { status: 401 }
      ),
    };
  }

  const userId = payload.sub;
  if (!userId || typeof userId !== "string") {
    return {
      response: NextResponse.json(
        { detail: "Invalid token payload" },
        { status: 401 }
      ),
    };
  }

  const supabase = createServerSupabaseClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id, role")
    .eq("id", userId)
    .maybeSingle();

  if (!profile) {
    return {
      response: NextResponse.json(
        { detail: "Profile not found" },
        { status: 401 }
      ),
    };
  }

  const role =
    profile.role === "tenant_admin" ? "tenant_admin" : "end_user";
  return {
    context: {
      tenantId: String(profile.tenant_id),
      userId: String(userId),
      role,
      isTenantAdmin: role === "tenant_admin",
    },
  };
}
