import { NextResponse } from "next/server";
import type { CurrentContext } from "./auth";

export function requireAdmin(
  context: CurrentContext
): { response: NextResponse } | null {
  if (!context.isTenantAdmin) {
    return {
      response: NextResponse.json({ detail: "Forbidden" }, { status: 403 }),
    };
  }
  return null;
}
