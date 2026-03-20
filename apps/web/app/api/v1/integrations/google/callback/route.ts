import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/server/auth";
import { consumeState } from "@/lib/server/google-oauth";
import * as integrationsDomain from "@/lib/server/domain/integrations";
import { logAudit } from "@/lib/server/domain/audit";

export async function POST(request: NextRequest) {
  const result = await getCurrentContext(request);
  if ("response" in result) return result.response;
  const { context } = result;

  let body: {
    code?: string;
    state?: string;
    display_name?: string;
    type?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { detail: "code and state required" },
      { status: 400 }
    );
  }

  const { code, state } = body;
  if (!code || !state) {
    return NextResponse.json(
      { detail: "code and state required" },
      { status: 400 }
    );
  }

  if (!consumeState(state)) {
    return NextResponse.json(
      { detail: "Invalid or expired state" },
      { status: 400 }
    );
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI?.trim();
  if (!clientId || !clientSecret || !redirectUri) {
    return NextResponse.json(
      { detail: "Google OAuth not configured" },
      { status: 503 }
    );
  }

  const hasServerSupabaseKey =
    !!process.env.SUPABASE_KEY || !!process.env.SUPABASE_SERVICE_ROLE_KEY;
  const hasEncryptionKey = !!process.env.ENCRYPTION_KEY && process.env.ENCRYPTION_KEY.length >= 32;
  if (!process.env.SUPABASE_URL || !hasServerSupabaseKey || !hasEncryptionKey) {
    return NextResponse.json(
      {
        detail:
          "Supabase server or encryption not configured in this environment. Set SUPABASE_URL + SUPABASE_KEY (service_role) or SUPABASE_SERVICE_ROLE_KEY, and ENCRYPTION_KEY (min 32 chars).",
      },
      { status: 503 }
    );
  }

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!tokenRes.ok) {
    const errBody = await tokenRes.text();
    let msg = errBody;
    try {
      const j = JSON.parse(errBody) as { error_description?: string; error?: string };
      msg = j.error_description ?? j.error ?? errBody;
    } catch {
      //
    }
    return NextResponse.json(
      { detail: `Token exchange failed: ${msg.slice(0, 200)}` },
      { status: 400 }
    );
  }

  const tokenData = (await tokenRes.json()) as { refresh_token?: string };
  const refreshToken = tokenData.refresh_token;
  if (!refreshToken) {
    return NextResponse.json(
      {
        detail:
          "Google did not return refresh_token. Revoke app access and try again with prompt=consent.",
      },
      { status: 400 }
    );
  }

  const integrationType =
    body.type === "google_sheets" ? "google_sheets" : "google_drive";

  const out = await integrationsDomain.createUserIntegration(
    context.tenantId,
    context.userId,
    integrationType,
    { refresh_token: refreshToken },
    body.display_name ?? null
  );

  if ("error" in out) {
    return NextResponse.json(
      { detail: out.error },
      { status: 400 }
    );
  }

  try {
    await logAudit(
      context.tenantId,
      context.userId,
      "integration_connected",
      "integration",
      String(out.row.id),
      { type: integrationType }
    );
  } catch {
    //
  }

  return NextResponse.json({ integration: out.row, success: true });
}

