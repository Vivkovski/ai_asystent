/**
 * One-off seed: create admin user (Auth + tenant + profile).
 * Requires SUPABASE_URL and SUPABASE_KEY (service_role). Optional: set SEED_SECRET and send X-Seed-Secret header.
 * POST body: { "email": "user@example.com", "password": "..." }
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const DEMO_TENANT_ID = "00000000-0000-0000-0000-000000000001";

export async function POST(request: NextRequest) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_KEY;
  if (!url || !key) {
    return NextResponse.json(
      { detail: "SUPABASE_URL and SUPABASE_KEY must be set" },
      { status: 503 }
    );
  }

  const seedSecret = process.env.SEED_SECRET;
  if (seedSecret) {
    const headerSecret = request.headers.get("x-seed-secret");
    if (headerSecret !== seedSecret) {
      return NextResponse.json({ detail: "Forbidden" }, { status: 403 });
    }
  }

  let body: { email?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { detail: "JSON body required: { email, password }" },
      { status: 400 }
    );
  }

  const email = typeof body.email === "string" ? body.email.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!email || !password) {
    return NextResponse.json(
      { detail: "email and password required" },
      { status: 400 }
    );
  }

  const supabase = createClient(url, key);

  const { data: userData, error: createError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name: email.split("@")[0] },
  });

  if (createError) {
    const msg = createError.message.toLowerCase();
    if (msg.includes("already") || msg.includes("exists") || msg.includes("duplicate")) {
      const { data: list } = await supabase.auth.admin.listUsers();
      const existing = list?.users?.find((u) => u.email === email);
      if (existing) {
        const userId = existing.id;
        await ensureTenantAndProfile(supabase, userId);
        return NextResponse.json({
          detail: "User already exists; tenant and profile updated.",
          user_id: userId,
        });
      }
    }
    return NextResponse.json(
      { detail: "Create user failed: " + createError.message },
      { status: 400 }
    );
  }

  const userId = userData.user?.id;
  if (!userId) {
    return NextResponse.json(
      { detail: "User created but id missing" },
      { status: 500 }
    );
  }

  await ensureTenantAndProfile(supabase, userId);

  return NextResponse.json({
    detail: "Admin user created. Log in with the given email and password.",
    user_id: userId,
  });
}

async function ensureTenantAndProfile(
  supabase: ReturnType<typeof createClient>,
  userId: string
) {
  await supabase.from("tenants").upsert(
    { id: DEMO_TENANT_ID, name: "Demo Tenant", slug: "demo", settings: {} },
    { onConflict: "id" }
  );
  await supabase.from("profiles").upsert(
    { id: userId, tenant_id: DEMO_TENANT_ID, role: "tenant_admin" },
    { onConflict: "id" }
  );
}
