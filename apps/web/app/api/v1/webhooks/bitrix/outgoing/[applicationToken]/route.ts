import { NextRequest, NextResponse } from "next/server";

type BitrixOutgoingWebhookPayload = {
  event?: string;
  ts?: string;
  auth?: {
    domain?: string;
    member_id?: string;
    application_token?: string;
    [k: string]: unknown;
  };
  data?: unknown;
  [k: string]: unknown;
};

function asString(v: FormDataEntryValue | null): string | undefined {
  if (v === null) return undefined;
  if (typeof v === "string") return v;
  return v.name; // file-like, should not happen for bitrix webhooks
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ applicationToken: string }> }
) {
  const expectedToken = (await params).applicationToken;

  const contentType = request.headers.get("content-type") ?? "";
  let payload: BitrixOutgoingWebhookPayload | null = null;

  try {
    if (contentType.includes("application/json")) {
      payload = (await request.json()) as BitrixOutgoingWebhookPayload;
    } else {
      const form = await request.formData();
      const event = asString(form.get("event"));
      const ts = asString(form.get("ts"));

      const domain = asString(form.get("auth[domain]"));
      const memberId = asString(form.get("auth[member_id]"));
      const applicationToken = asString(form.get("auth[application_token]"));

      // Bitrix usually sends nested `data[...]` keys as flattened form fields.
      // For now we just keep the whole form as `data`-ish information for debugging.
      const data: Record<string, string> = {};
      for (const [k, v] of form.entries()) {
        if (k.startsWith("data[")) data[k] = asString(v) ?? "";
      }
      payload = {
        event,
        ts,
        auth: {
          domain,
          member_id: memberId,
          application_token: applicationToken,
        },
        data,
      };
    }
  } catch {
    return NextResponse.json(
      { ok: false, error: "INVALID_BODY" },
      { status: 400 }
    );
  }

  const receivedToken =
    payload?.auth?.application_token ??
    // Some clients may send dot-notation instead of bracket-notation.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (payload as any)?.["auth.application_token"];

  if (!receivedToken || receivedToken !== expectedToken) {
    return NextResponse.json(
      { ok: false, error: "INVALID_TOKEN" },
      { status: 401 }
    );
  }

  // Avoid logging token. Keep only non-sensitive identifiers.
  console.log("[bitrix outgoing webhook]", {
    event: payload?.event,
    ts: payload?.ts,
    domain: payload?.auth?.domain,
    member_id: payload?.auth?.member_id,
  });

  return NextResponse.json({
    ok: true,
    received: true,
    event: payload?.event ?? null,
  });
}

