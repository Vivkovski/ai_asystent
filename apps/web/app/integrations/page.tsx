"use client";

import { createClient } from "@/lib/supabase/client";
import { apiFetch } from "@/lib/api-client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Badge, Card, PageTitle } from "@/components/ui";

type Integration = {
  id: string;
  type: string;
  display_name: string | null;
  enabled: boolean;
  last_tested_at?: string | null;
  last_error?: string | null;
  created_at?: string;
  updated_at?: string;
};

const TYPE_LABELS: Record<string, string> = {
  bitrix: "Bitrix24",
  google_drive: "Google Drive",
  google_sheets: "Google Sheets",
};

const AVAILABLE_TYPES = [
  { id: "bitrix", label: "Bitrix24", description: "CRM, kontakty, zadania i dokumenty z Bitrix24." },
  { id: "google_drive", label: "Google Drive", description: "Pliki i foldery z Dysku Google." },
  { id: "google_sheets", label: "Google Sheets", description: "Arkusze i dane z Google Sheets." },
] as const;

export default function IntegrationsPage() {
  const [tenantItems, setTenantItems] = useState<Integration[]>([]);
  const [userItems, setUserItems] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);

  const fetchIntegrations = useCallback(async (accessToken: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch("/api/v1/integrations", {
        accessToken,
        cache: "no-store",
        headers: { "Cache-Control": "no-cache", Pragma: "no-cache" },
      });
      if (!res.ok) throw new Error(res.statusText);
      const data = (await res.json()) as {
        tenant_items?: Integration[];
        user_items?: Integration[];
      };
      setTenantItems(data.tenant_items ?? []);
      setUserItems(data.user_items ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Błąd ładowania");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setToken(session.access_token);
    });
  }, []);

  useEffect(() => {
    if (!token) return;
    fetchIntegrations(token);
  }, [token, fetchIntegrations]);

  useEffect(() => {
    if (!token) return;
    const onFocus = () => fetchIntegrations(token);
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [token, fetchIntegrations]);

  // Po zalogowaniu przez Google (callback przekierowuje z ?added=...)
  useEffect(() => {
    if (!token || typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (!params.has("added")) return;
    const t = setTimeout(() => fetchIntegrations(token), 800);
    return () => clearTimeout(t);
  }, [token, fetchIntegrations]);

  const getStatusVariant = (row: Integration): "success" | "warning" | "error" => {
    if (!row.enabled) return "warning";
    if (row.last_error) return "error";
    return "success";
  };

  const tenantEnabledTypes = new Set(
    tenantItems.filter((i) => i.enabled).map((i) => i.type)
  );
  const userIntegrationsByType = (type: string) => userItems.filter((i) => i.type === type);

  const renderUserList = () => {
    if (loading) return <p className="text-neutral-600">Ładowanie listy…</p>;
    if (error) return <p className="text-error">Błąd: {error}</p>;
    if (!token) return <p className="text-neutral-600">Ładowanie…</p>;

    if (userItems.length === 0) {
      return <p className="text-neutral-600">Nie dodałeś jeszcze żadnych własnych integracji.</p>;
    }

    return (
      <table className="w-full border-collapse border border-neutral-200">
        <thead>
          <tr className="bg-neutral-50">
            <th className="border border-neutral-200 p-2 text-left">Typ</th>
            <th className="border border-neutral-200 p-2 text-left">Nazwa</th>
            <th className="border border-neutral-200 p-2 text-left">Status</th>
            <th className="border border-neutral-200 p-2 text-left">Ostatni test</th>
            <th className="border border-neutral-200 p-2 text-left">Błąd</th>
            <th className="border border-neutral-200 p-2 text-left">Akcje</th>
          </tr>
        </thead>
        <tbody>
          {userItems.map((row) => (
            <tr key={row.id}>
              <td className="border border-neutral-200 p-2">
                {TYPE_LABELS[row.type] || row.type}
              </td>
              <td className="border border-neutral-200 p-2">{row.display_name || "—"}</td>
              <td className="border border-neutral-200 p-2">
                <Badge variant={getStatusVariant(row)}>
                  {row.enabled ? (row.last_error ? "Błąd" : "Połączono") : "Wyłączona"}
                </Badge>
              </td>
              <td className="border border-neutral-200 p-2 text-sm text-neutral-600">
                {row.last_tested_at ? new Date(row.last_tested_at).toLocaleString() : "—"}
              </td>
              <td
                className="border border-neutral-200 p-2 text-sm text-error max-w-xs truncate"
                title={row.last_error || ""}
              >
                {row.last_error || "—"}
              </td>
              <td className="border border-neutral-200 p-2">
                <Link href={`/integrations/${row.id}`} className="text-primary-600 text-sm hover:underline">
                  Edytuj
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  return (
    <div>
      <PageTitle
        title="Integracje"
        description="Twoje własne integracje. Jeśli tenant ma aktywną integrację tego typu, ona ma pierwszeństwo."
      />

      <section className="mb-8">
        <h2 className="text-lg font-semibold text-neutral-800 mb-3">Dostępne integracje</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {AVAILABLE_TYPES.map((t) => {
            const userRows = userIntegrationsByType(t.id);
            const added = userRows.length;
            const userConnected = userRows.some((i) => i.enabled && !i.last_error);
            const tenantEnabled = tenantEnabledTypes.has(t.id);

            return (
              <Link key={t.id} href={`/integrations/add?type=${t.id}`} className="block">
                <Card className="p-4 h-full hover:border-primary-400 hover:shadow-sm transition-all">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-neutral-800">{t.label}</h3>
                    {tenantEnabled ? (
                      <Badge variant="success" className="shrink-0">
                        Tenant aktywny
                      </Badge>
                    ) : userConnected ? (
                      <Badge variant="success" className="shrink-0">
                        Połączono
                      </Badge>
                    ) : null}
                  </div>
                  <p className="mt-1 text-sm text-neutral-600">{t.description}</p>
                  <p className="mt-3 text-sm text-neutral-500">
                    {added > 0 ? (
                      <span className="text-primary-600">
                        Masz {added} {added === 1 ? "integrację" : "integracje"}.
                      </span>
                    ) : (
                      "Nie dodałeś jeszcze."
                    )}
                  </p>
                  <span className="mt-2 inline-block text-primary-600 text-sm font-medium">
                    Dodaj / zmień swoje ustawienia →
                  </span>
                </Card>
              </Link>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-neutral-800 mb-3">Twoje integracje</h2>
        {renderUserList()}
      </section>
    </div>
  );
}

