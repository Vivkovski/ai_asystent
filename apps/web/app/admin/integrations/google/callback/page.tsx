"use client";

import { createClient } from "@/lib/supabase/client";
import { apiFetch } from "@/lib/api-client";
import { useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";

const PENDING_KEY = "google_oauth_pending";

export default function GoogleOAuthCallbackPage() {
  return (
    <Suspense fallback={<p>Przetwarzanie…</p>}>
      <GoogleOAuthCallback />
    </Suspense>
  );
}

function GoogleOAuthCallback() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"loading" | "ok" | "err">("loading");
  const [message, setMessage] = useState<string | null>(null);
  const [flowMode, setFlowMode] = useState<"tenant" | "user">("tenant");

  useEffect(() => {
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    if (!code || !state) {
      setStatus("err");
      setMessage("Brak parametrów code lub state w adresie.");
      return;
    }

    let pending: { mode?: "tenant" | "user"; type?: string; displayName?: string } = {};
    try {
      const raw = typeof window !== "undefined" ? window.sessionStorage.getItem(PENDING_KEY) : null;
      if (raw) pending = JSON.parse(raw);
    } catch {
      /* ignore */
    }
    setFlowMode(pending.mode === "user" ? "user" : "tenant");

    const run = async () => {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setStatus("err");
        setMessage("Zaloguj się ponownie i spróbuj jeszcze raz.");
        return;
      }

      const body: Record<string, string> = { code, state };
      if (pending.type) body.type = pending.type;
      if (pending.displayName) body.display_name = pending.displayName;

      const isUserFlow = pending.mode === "user";
      const res = await apiFetch(
        isUserFlow
          ? "/api/v1/integrations/google/callback"
          : "/api/v1/admin/integrations/google/callback",
        {
        method: "POST",
        accessToken: session.access_token,
        body: JSON.stringify(body),
        }
      );

      if (typeof window !== "undefined") window.sessionStorage.removeItem(PENDING_KEY);

      if (res.ok) {
        setStatus("ok");
        const type = pending.type === "google_sheets" ? "google_sheets" : "google_drive";
        const base = isUserFlow ? "/integrations" : "/admin/integrations";
        window.location.href = `${base}?added=${type}`;
        return;
      }

      const data = await res.json().catch(() => ({}));
      setStatus("err");
      setMessage(data.detail || res.statusText || "Połączenie z Google nie powiodło się.");
    };

    run();
  }, [searchParams]);

  if (status === "loading") return <p>Przetwarzanie…</p>;
  if (status === "ok") return <p>Przekierowuję…</p>;
  return (
    <div className="max-w-md mt-4">
      <p className="text-red-600 mb-2">{message}</p>
      <a
        href={flowMode === "user" ? "/integrations/add" : "/admin/integrations/add"}
        className="text-blue-600 hover:underline"
      >
        ← Wróć do dodawania integracji
      </a>
    </div>
  );
}
