import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/server/auth";
import { requireAdmin } from "@/lib/server/auth-admin";
import { setState } from "@/lib/server/google-oauth";

const GOOGLE_DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.readonly";

export async function GET(request: NextRequest) {
  const result = await getCurrentContext(request);
  if ("response" in result) return result.response;
  const { context } = result;
  const forbidden = requireAdmin(context);
  if (forbidden) return forbidden.response;
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI?.trim();
  if (!clientId) {
    return NextResponse.json(
      { detail: "Google OAuth not configured (GOOGLE_CLIENT_ID)" },
      { status: 503 }
    );
  }
  if (!redirectUri) {
    return NextResponse.json(
      { detail: "GOOGLE_OAUTH_REDIRECT_URI not configured" },
      { status: 503 }
    );
  }
  const state = crypto.randomUUID().replace(/-/g, "");
  setState(state);
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", GOOGLE_DRIVE_SCOPE);
  url.searchParams.set("state", state);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  return NextResponse.json({ url: url.toString(), state });
}
