"use client";

import { createClient } from "@/lib/supabase/client";
import { apiFetch } from "@/lib/api-client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Badge, Button, PageTitle } from "@/components/ui";

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

  if (!token) return <p className="text-neutral-600">Ładowanie…</p>;
  if (loading) return <p className="text-neutral-600">Ładowanie listy…</p>;
  if (error) return <p className="text-error">Błąd: {error}</p>;

  const getStatusVariant = (row: Integration): "success" | "warning" | "error" => {
    if (!row.enabled) return "warning";
    if (row.last_error) return "error";
    return "success";
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <PageTitle title="Integracje" />
        <Link href="/admin/integrations/add">
          <Button variant="primary" size="md">
            Dodaj integrację
          </Button>
        </Link>
      </div>
      {items.length === 0 ? (
        <p className="text-neutral-600">Brak integracji. Dodaj pierwszą, aby asystent mógł korzystać z danych.</p>
      ) : (
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
      )}
    </div>
  );
}
