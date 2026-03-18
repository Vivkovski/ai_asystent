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

  const canSave =
    type === "bitrix"
      ? webhookUrl.trim().length > 0
      : type === "google_drive" || type === "google_sheets"
        ? refreshToken.trim().length > 0
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
          <div>
            <label className="block text-sm font-medium mb-1">Refresh token (Google OAuth)</label>
            <input
              type="password"
              value={refreshToken}
              onChange={(e) => setRefreshToken(e.target.value)}
              placeholder="Wklej refresh_token z OAuth (np. Google OAuth Playground)"
              className="w-full border rounded px-3 py-2 font-mono text-sm"
            />
            <p className="text-xs text-gray-500 mt-1">
              Uzyskaj refresh_token w Google Cloud Console (OAuth 2.0) lub OAuth Playground. Backend wymaga GOOGLE_CLIENT_ID i GOOGLE_CLIENT_SECRET.
            </p>
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
