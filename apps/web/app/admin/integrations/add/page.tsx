"use client";

import { createClient } from "@/lib/supabase/client";
import { apiFetch } from "@/lib/api-client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";

const TYPES = [
  { id: "bitrix", label: "Bitrix24" },
  { id: "google_drive", label: "Google Drive" },
  { id: "google_sheets", label: "Google Sheets" },
];

const GOOGLE_OAUTH_PENDING_KEY = "google_oauth_pending";

export default function AddIntegrationPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [type, setType] = useState("bitrix");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [refreshToken, setRefreshToken] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [testStatus, setTestStatus] = useState<"idle" | "loading" | "ok" | "err">("idle");
  const [testError, setTestError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "loading" | "ok" | "err">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [showManualToken, setShowManualToken] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setToken(session.access_token);
    });
  }, []);

  const credentials =
    type === "bitrix"
      ? { webhook_url: webhookUrl }
      : type === "google_drive"
        ? { refresh_token: refreshToken.trim() }
        : type === "google_sheets"
          ? { refresh_token: refreshToken.trim() }
          : {};

  const handleTest = async () => {
    if (!token) return;
    setTestStatus("loading");
    setTestError(null);
    const res = await apiFetch("/api/v1/admin/integrations", {
      method: "POST",
      accessToken: token,
      body: JSON.stringify({
        type,
        credentials,
        display_name: displayName || undefined,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setTestStatus("ok");
      setSaveStatus("ok");
      router.push("/admin/integrations");
      router.refresh();
      return;
    }
    setTestStatus("err");
    setTestError(data.detail || res.statusText);
  };

  const handleSave = () => {
    handleTest();
  };

  const handleConnectGoogle = async () => {
    if (!token) return;
    setOauthLoading(true);
    setTestError(null);
    try {
      const res = await apiFetch("/api/v1/admin/integrations/google/authorize-url", {
        method: "GET",
        accessToken: token,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setTestError(data.detail || res.statusText || "Nie udało się uzyskać adresu Google.");
        return;
      }
      const url = data.url;
      if (!url) {
        setTestError("Brak adresu w odpowiedzi.");
        return;
      }
      try {
        sessionStorage.setItem(
          GOOGLE_OAUTH_PENDING_KEY,
          JSON.stringify({ type, displayName: displayName || undefined })
        );
      } catch {
        /* ignore */
      }
      window.location.href = url;
    } finally {
      setOauthLoading(false);
    }
  };

  const canSave =
    type === "bitrix"
      ? webhookUrl.trim().length > 0
      : type === "google_drive" || type === "google_sheets"
        ? refreshToken.trim().length > 0  // manual token path
        : false;

  if (!token) return <p>Ładowanie…</p>;

  return (
    <div className="max-w-md">
      <Link href="/admin/integrations" className="text-blue-600 text-sm hover:underline mb-4 inline-block">
        ← Lista integracji
      </Link>
      <h1 className="text-xl font-semibold mb-4">Dodaj integrację</h1>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Typ</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="w-full border rounded px-3 py-2"
          >
            {TYPES.map((t) => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Nazwa (opcjonalnie)</label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder={TYPES.find((t) => t.id === type)?.label}
            className="w-full border rounded px-3 py-2"
          />
        </div>
        {type === "bitrix" && (
          <div>
            <label className="block text-sm font-medium mb-1">URL webhooka Bitrix24</label>
            <input
              type="url"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              placeholder="https://..."
              className="w-full border rounded px-3 py-2"
            />
          </div>
        )}
        {(type === "google_drive" || type === "google_sheets") && (
          <div className="space-y-3">
            <div>
              <button
                type="button"
                onClick={handleConnectGoogle}
                disabled={oauthLoading || !token}
                className="rounded bg-white border border-gray-300 text-gray-700 px-4 py-2 text-sm font-medium flex items-center gap-2 hover:bg-gray-50 disabled:opacity-50"
              >
                {oauthLoading ? (
                  "Przekierowuję…"
                ) : (
                  <>
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    Zaloguj się przez Google
                  </>
                )}
              </button>
              <p className="text-xs text-gray-500 mt-1">
                Zostaniesz przekierowany do Google; po zalogowaniu integracja zostanie dodana automatycznie.
              </p>
            </div>
            <div>
              <button
                type="button"
                onClick={() => setShowManualToken((v) => !v)}
                className="text-sm text-gray-600 hover:underline"
              >
                {showManualToken ? "Ukryj" : "Albo wklej refresh token ręcznie"}
              </button>
              {showManualToken && (
                <div className="mt-2">
                  <input
                    type="password"
                    value={refreshToken}
                    onChange={(e) => setRefreshToken(e.target.value)}
                    placeholder="Refresh token z OAuth Playground"
                    className="w-full border rounded px-3 py-2 font-mono text-sm mt-1"
                  />
                </div>
              )}
            </div>
          </div>
        )}
        {testStatus === "err" && testError && (
          <p className="text-sm text-red-600">{testError}</p>
        )}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave || saveStatus === "loading" || testStatus === "loading"}
            className="rounded bg-blue-600 text-white px-4 py-2 text-sm font-medium disabled:opacity-50 hover:bg-blue-700"
          >
            {saveStatus === "loading" || testStatus === "loading" ? "Zapisywanie…" : "Testuj i zapisz"}
          </button>
        </div>
      </div>
    </div>
  );
}
