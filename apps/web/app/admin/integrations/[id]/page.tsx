"use client";

import { createClient } from "@/lib/supabase/client";
import { apiFetch } from "@/lib/api-client";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { useState, useEffect } from "react";

export default function EditIntegrationPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const [token, setToken] = useState<string | null>(null);
  const [row, setRow] = useState<{
    id: string;
    type: string;
    display_name: string | null;
    enabled: boolean;
    last_error: string | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [action, setAction] = useState<"reconnect" | "disable" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setToken(session.access_token);
    });
  }, []);

  useEffect(() => {
    if (!token || !id) return;
    apiFetch(`/api/v1/admin/integrations/${id}`, { accessToken: token })
      .then((res) => {
        if (!res.ok) throw new Error("Not found");
        return res.json();
      })
      .then(setRow)
      .catch(() => setRow(null))
      .finally(() => setLoading(false));
  }, [token, id]);

  const handleReconnect = async () => {
    if (!token || !id || row?.type !== "bitrix") return;
    setAction("reconnect");
    setError(null);
    const res = await apiFetch(`/api/v1/admin/integrations/${id}`, {
      method: "PATCH",
      accessToken: token,
      body: JSON.stringify({ credentials: { webhook_url: webhookUrl } }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setRow((p) => p ? { ...p, last_error: null } : null);
      setAction(null);
      router.refresh();
      return;
    }
    setError(data.detail || res.statusText);
    setAction(null);
  };

  const handleDisable = async () => {
    if (!token || !id) return;
    setAction("disable");
    setError(null);
    const res = await apiFetch(`/api/v1/admin/integrations/${id}`, {
      method: "PATCH",
      accessToken: token,
      body: JSON.stringify({ enabled: false }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setRow((p) => p ? { ...p, enabled: false } : null);
      setAction(null);
      router.refresh();
      return;
    }
    setError(data.detail || res.statusText);
    setAction(null);
  };

  const handleEnable = async () => {
    if (!token || !id) return;
    setAction("reconnect");
    const res = await apiFetch(`/api/v1/admin/integrations/${id}`, {
      method: "PATCH",
      accessToken: token,
      body: JSON.stringify({ enabled: true }),
    });
    if (res.ok) {
      setRow((p) => p ? { ...p, enabled: true } : null);
      setAction(null);
      router.refresh();
    } else setAction(null);
  };

  if (!token) return <p>Ładowanie…</p>;
  if (loading || !row) return <p>{row === null ? "Nie znaleziono" : "Ładowanie…"}</p>;

  return (
    <div className="max-w-lg">
      <Link href="/admin/integrations" className="text-blue-600 text-sm hover:underline mb-4 inline-block">
        ← Lista integracji
      </Link>
      <h1 className="text-xl font-semibold mb-2">Integracja: {row.display_name || row.type}</h1>
      <p className="text-sm text-gray-600 mb-4">Typ: {row.type} · Status: {row.enabled ? "Włączona" : "Wyłączona"}</p>
      {row.last_error && <p className="text-sm text-red-600 mb-2">Ostatni błąd: {row.last_error}</p>}
      {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
      <div className="space-y-4">
        {row.type === "bitrix" && (
          <div>
            <label className="block text-sm font-medium mb-1">URL webhooka (re-auth)</label>
            <input
              type="url"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              placeholder="https://..."
              className="w-full border rounded px-3 py-2"
            />
            <button
              type="button"
              onClick={handleReconnect}
              disabled={action !== null || !webhookUrl.trim()}
              className="mt-2 rounded bg-amber-600 text-white px-4 py-2 text-sm font-medium disabled:opacity-50 hover:bg-amber-700"
            >
              {action === "reconnect" ? "Zapisywanie…" : "Połącz ponownie"}
            </button>
          </div>
        )}
        {row.enabled ? (
          <button
            type="button"
            onClick={handleDisable}
            disabled={action !== null}
            className="rounded border border-red-300 text-red-700 px-4 py-2 text-sm font-medium hover:bg-red-50"
          >
            {action === "disable" ? "…" : "Wyłącz"}
          </button>
        ) : (
          <button
            type="button"
            onClick={handleEnable}
            disabled={action !== null}
            className="rounded bg-green-600 text-white px-4 py-2 text-sm font-medium hover:bg-green-700"
          >
            Włącz
          </button>
        )}
      </div>
    </div>
  );
}
