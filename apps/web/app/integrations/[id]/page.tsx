"use client";

import { createClient } from "@/lib/supabase/client";
import { apiFetch } from "@/lib/api-client";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Button, Input, PageTitle } from "@/components/ui";

type IntegrationRow = {
  id: string;
  type: string;
  display_name: string | null;
  enabled: boolean;
  last_error: string | null;
};

export default function EditIntegrationPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [token, setToken] = useState<string | null>(null);
  const [row, setRow] = useState<IntegrationRow | null>(null);
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
    apiFetch(`/api/v1/integrations/${id}`, { accessToken: token })
      .then((res) => {
        if (!res.ok) throw new Error("Not found");
        return res.json();
      })
      .then((data) => setRow(data as IntegrationRow))
      .catch(() => setRow(null))
      .finally(() => setLoading(false));
  }, [token, id]);

  const handleReconnect = async () => {
    if (!token || !id || row?.type !== "bitrix") return;
    setAction("reconnect");
    setError(null);

    const res = await apiFetch(`/api/v1/integrations/${id}`, {
      method: "PATCH",
      accessToken: token,
      body: JSON.stringify({ credentials: { webhook_url: webhookUrl } }),
    });

    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setRow((p) => (p ? { ...p, last_error: null } : null));
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

    const res = await apiFetch(`/api/v1/integrations/${id}`, {
      method: "PATCH",
      accessToken: token,
      body: JSON.stringify({ enabled: false }),
    });

    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setRow((p) => (p ? { ...p, enabled: false } : null));
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

    const res = await apiFetch(`/api/v1/integrations/${id}`, {
      method: "PATCH",
      accessToken: token,
      body: JSON.stringify({ enabled: true }),
    });

    if (res.ok) {
      setRow((p) => (p ? { ...p, enabled: true } : null));
      setAction(null);
      router.refresh();
    } else {
      setAction(null);
    }
  };

  if (!token) return <p className="text-neutral-600">Ładowanie…</p>;
  if (loading || !row)
    return <p className="text-neutral-600">{row === null ? "Nie znaleziono" : "Ładowanie…"}</p>;

  return (
    <div className="max-w-lg">
      <Link href="/integrations" className="text-primary-600 text-sm hover:underline mb-4 inline-block">
        ← Lista integracji
      </Link>

      <PageTitle
        title={`Integracja: ${row.display_name || row.type}`}
        description={`Typ: ${row.type} · Status: ${row.enabled ? "Włączona" : "Wyłączona"}`}
        className="mb-4"
      />

      {row.last_error && <p className="text-sm text-error mb-2">Ostatni błąd: {row.last_error}</p>}
      {error && <p className="text-sm text-error mb-2">{error}</p>}

      <div className="space-y-4">
        {row.type === "bitrix" && (
          <div>
            <Input
              label="URL webhooka (re-auth)"
              type="url"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              placeholder="https://..."
            />
            <Button
              type="button"
              variant="secondary"
              className="mt-2"
              onClick={handleReconnect}
              disabled={action !== null || !webhookUrl.trim()}
            >
              {action === "reconnect" ? "Zapisywanie…" : "Połącz ponownie"}
            </Button>
          </div>
        )}

        {row.enabled ? (
          <Button
            type="button"
            variant="danger"
            onClick={handleDisable}
            disabled={action !== null}
          >
            {action === "disable" ? "…" : "Wyłącz"}
          </Button>
        ) : (
          <Button
            type="button"
            variant="success"
            onClick={handleEnable}
            disabled={action !== null}
          >
            Włącz
          </Button>
        )}
      </div>
    </div>
  );
}

