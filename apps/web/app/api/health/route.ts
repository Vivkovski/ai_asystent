import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const debug = request.nextUrl.searchParams.get("debug");
  const body: Record<string, unknown> = { status: "ok" };
  if (debug === "1") {
    body.auth_config = {
      supabase_url_set: !!process.env.SUPABASE_URL,
      supabase_key_set: !!process.env.SUPABASE_KEY,
      supabase_jwt_secret_set: !!process.env.SUPABASE_JWT_SECRET,
    };
  }
  return NextResponse.json(body);
}
