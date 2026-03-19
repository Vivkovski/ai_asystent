import { NextResponse } from "next/server";

export async function GET() {
  const supabaseKeySet =
    !!process.env.SUPABASE_KEY || !!process.env.SUPABASE_SERVICE_ROLE_KEY;
  return NextResponse.json({
    supabase_url_set: !!process.env.SUPABASE_URL,
    supabase_key_set: supabaseKeySet,
    supabase_jwt_secret_set: !!process.env.SUPABASE_JWT_SECRET,
  });
}
