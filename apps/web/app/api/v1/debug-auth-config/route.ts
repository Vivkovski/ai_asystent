import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    supabase_url_set: !!process.env.SUPABASE_URL,
    supabase_key_set: !!process.env.SUPABASE_KEY,
    supabase_jwt_secret_set: !!process.env.SUPABASE_JWT_SECRET,
  });
}
