"use client";

import { createClient } from "@/lib/supabase/client";
import { apiFetch } from "@/lib/api-client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Badge, Card, PageTitle } from "@/components/ui";

type Integration = {
  id: string;
  type: string;
  display_name: string | null;
  enabled: boolean;
  last_tested_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
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

export default function AdminIntegrationsPage() {
  const [items, setItems] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setToken(session.access_token);
    });
  }, []);

  useEffect(() => {
    if (!token) return;
    apiFetch("/api/v1/admin/integrations", { accessToken: token })
      .then((res) => {
        if (!res.ok) throw new Error(res.statusText);
        return res.json();
      })
      .then((data: { items: Integration[] }) => setItems(data.items || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  const getStatusVariant = (row: Integration): "success" | "warning" | "error" => {
    if (!row.enabled) return "warning";
    if (row.last_error) return "error";
    return "success";
  };

  const countByType = (type: string) => items.filter((i) => i.type === type).length;

  const renderListSection = () => {
    if (!token) return <p className="text-neutral-600">Ładowanie…</p>;
    if (loading) return <p className="text-neutral-600">Ładowanie listy…</p>;
    if (error) return <p className="text-error">Błąd: {error}</p>;
    if (items.length === 0) {
      return (
        <p className="text-neutral-600">
          Brak dodanych integracji. Wybierz kafelek powyżej, aby dodać pierwszą.
        </p>
      );
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
          {items.map((row) => (
            <tr key={row.id}>
              <td className="border border-neutral-200 p-2">{TYPE_LABELS[row.type] || row.type}</td>
              <td className="border border-neutral-200 p-2">{row.display_name || "—"}</td>
              <td className="border border-neutral-200 p-2">
                <Badge variant={getStatusVariant(row)}>
                  {row.enabled ? (row.last_error ? "Błąd" : "Połączono") : "Wyłączona"}
                </Badge>
              </td>
              <td className="border border-neutral-200 p-2 text-sm text-neutral-600">
                {row.last_tested_at ? new Date(row.last_tested_at).toLocaleString() : "—"}
              </td>
              <td className="border border-neutral-200 p-2 text-sm text-error max-w-xs truncate" title={row.last_error || ""}>
                {row.last_error || "—"}
              </td>
              <td className="border border-neutral-200 p-2">
                <Link href={`/admin/integrations/${row.id}`} className="text-primary-600 text-sm hover:underline">
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
        description="Podłącz źródła danych, z których asystent będzie korzystał w odpowiedziach."
      />
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-neutral-800 mb-3">Dostępne integracje</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {AVAILABLE_TYPES.map((t) => {
            const added = countByType(t.id);
            return (
              <Link key={t.id} href={`/admin/integrations/add?type=${t.id}`} className="block">
                <Card className="p-4 h-full hover:border-primary-400 hover:shadow-sm transition-all">
                  <h3 className="font-semibold text-neutral-800">{t.label}</h3>
                  <p className="mt-1 text-sm text-neutral-600">{t.description}</p>
                  <p className="mt-3 text-sm text-neutral-500">
                    {added > 0 ? (
                      <span className="text-primary-600">{added} {added === 1 ? "dodana" : "dodane"}</span>
                    ) : (
                      "Nie dodano"
                    )}
                  </p>
                  <span className="mt-2 inline-block text-primary-600 text-sm font-medium">
                    {added > 0 ? "Dodaj kolejną" : "Dodaj integrację"} →
                  </span>
                </Card>
              </Link>
            );
          })}
        </div>
      </section>
      <section>
        <h2 className="text-lg font-semibold text-neutral-800 mb-3">Twoje integracje</h2>
        {renderListSection()}
      </section>
    </div>
  );
}
