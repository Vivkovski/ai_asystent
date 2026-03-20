"use client";

import { createClient } from "@/lib/supabase/client";
import { apiFetch } from "@/lib/api-client";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { useState, useEffect } from "react";
import { Button, Input, Label, PageTitle } from "@/components/ui";

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
  const [bitrixInputMode, setBitrixInputMode] = useState<"full" | "parts">("full");
  const [bitrixWebhookMode, setBitrixWebhookMode] = useState<"incoming" | "outgoing">("incoming");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [bitrixDomain, setBitrixDomain] = useState("");
  const [bitrixUserId, setBitrixUserId] = useState("");
  const [bitrixWebhookCode, setBitrixWebhookCode] = useState("");
  const [bitrixApplicationToken, setBitrixApplicationToken] = useState("");
  const [action, setAction] = useState<"reconnect" | "disable" | null>(null);
  const [deleteStatus, setDeleteStatus] = useState<"idle" | "loading" | "err">("idle");
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
    const credentials =
      bitrixWebhookMode === "incoming"
        ? bitrixInputMode === "full"
          ? { webhook_url: webhookUrl }
          : {
              bitrix_domain: bitrixDomain.trim(),
              user_id: bitrixUserId.trim(),
              webhook_code: bitrixWebhookCode.trim(),
            }
        : {
            webhook_mode: "outgoing",
            application_token: bitrixApplicationToken.trim(),
          };
    const res = await apiFetch(`/api/v1/admin/integrations/${id}`, {
      method: "PATCH",
      accessToken: token,
      body: JSON.stringify({ credentials }),
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

  const handleDelete = async () => {
    if (!token || !id) return;
    const ok = window.confirm("Usunąć integrację? Tej operacji nie da się cofnąć.");
    if (!ok) return;

    setDeleteStatus("loading");
    setError(null);

    const res = await apiFetch(`/api/v1/admin/integrations/${id}`, {
      method: "DELETE",
      accessToken: token,
    });

    if (res.ok) {
      router.push("/admin/integrations");
      router.refresh();
      return;
    }

    const data = await res.json().catch(() => ({}));
    setDeleteStatus("err");
    setError(data?.detail || data?.message || res.statusText);
  };

  if (!token) return <p className="text-neutral-600">Ładowanie…</p>;
  if (loading || !row) return <p className="text-neutral-600">{row === null ? "Nie znaleziono" : "Ładowanie…"}</p>;

  return (
    <div className="max-w-lg">
      <Link href="/admin/integrations" className="text-primary-600 text-sm hover:underline mb-4 inline-block">
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
            <div className="space-y-3">
              <div>
                <Label>Tryb webhooka</Label>
                <select
                  value={bitrixWebhookMode}
                  onChange={(e) =>
                    setBitrixWebhookMode(e.target.value as "incoming" | "outgoing")
                  }
                  className="w-full border border-neutral-200 rounded px-3 py-2"
                >
                  <option value="incoming">Przychodzący (Incoming REST / dane do rozmów)</option>
                  <option value="outgoing">Wychodzący (Outgoing / zdarzenia na nasz endpoint)</option>
                </select>
                <p className="text-xs text-neutral-500 mt-1">
                  Incoming REST służy do pobierania danych (CRM). Outgoing jest dla on-prem, żeby Bitrix wysyłał zdarzenia do Twojej aplikacji.
                </p>
              </div>

              {bitrixWebhookMode === "incoming" ? (
                <>
                  <div className="flex gap-2 items-center">
                    <Button
                      type="button"
                      variant={bitrixInputMode === "full" ? "primary" : "secondary"}
                      size="md"
                      onClick={() => setBitrixInputMode("full")}
                      className="!px-3"
                    >
                      Wklej URL
                    </Button>
                    <Button
                      type="button"
                      variant={bitrixInputMode === "parts" ? "primary" : "secondary"}
                      size="md"
                      onClick={() => setBitrixInputMode("parts")}
                      className="!px-3"
                    >
                      Podaj składniki
                    </Button>
                  </div>

                  {bitrixInputMode === "full" ? (
                    <Input
                      label="URL webhooka Bitrix24 (re-auth)"
                      type="url"
                      value={webhookUrl}
                      onChange={(e) => setWebhookUrl(e.target.value)}
                      placeholder="https://my.bitrix24.com/rest/<user_id>/<webhook_code>/"
                    />
                  ) : (
                    <div className="space-y-3">
                      <Input
                        label="Domain Bitrix24 (np. my.bitrix24.com)"
                        type="text"
                        value={bitrixDomain}
                        onChange={(e) => setBitrixDomain(e.target.value)}
                        placeholder="my.bitrix24.com"
                      />
                      <Input
                        label="user_id (twórca webhooka)"
                        type="text"
                        value={bitrixUserId}
                        onChange={(e) => setBitrixUserId(e.target.value)}
                        placeholder="1"
                      />
                      <Input
                        label="webhook_code (sekretny kod)"
                        type="text"
                        value={bitrixWebhookCode}
                        onChange={(e) => setBitrixWebhookCode(e.target.value)}
                        placeholder="abc123"
                        className="font-mono"
                      />
                    </div>
                  )}
                </>
              ) : (
                <div className="space-y-3">
                  <Input
                    label="token aplikacji (application_token) z Outgoing webhooka"
                    type="text"
                    value={bitrixApplicationToken}
                    onChange={(e) => setBitrixApplicationToken(e.target.value)}
                    placeholder="y4361mivtxtyo..."
                    className="font-mono"
                  />
                </div>
              )}
            </div>
            <Button
              type="button"
              variant="secondary"
              className="mt-2"
              onClick={handleReconnect}
              disabled={
                action !== null ||
                (bitrixWebhookMode === "incoming"
                  ? bitrixInputMode === "full"
                    ? !webhookUrl.trim()
                    : !bitrixDomain.trim() || !bitrixUserId.trim() || !bitrixWebhookCode.trim()
                  : !bitrixApplicationToken.trim())
              }
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
            disabled={action !== null || deleteStatus === "loading"}
          >
            {action === "disable" ? "…" : "Wyłącz"}
          </Button>
        ) : (
          <Button
            type="button"
            variant="success"
            onClick={handleEnable}
            disabled={action !== null || deleteStatus === "loading"}
          >
            Włącz
          </Button>
        )}

        <Button
          type="button"
          variant="danger"
          onClick={handleDelete}
          disabled={action !== null || deleteStatus === "loading"}
        >
          {deleteStatus === "loading" ? "Usuwanie…" : "Usuń"}
        </Button>
      </div>
    </div>
  );
}
