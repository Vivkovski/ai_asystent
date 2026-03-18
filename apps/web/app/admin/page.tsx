"use client";

import { createClient } from "@/lib/supabase/client";
import { apiFetch } from "@/lib/api-client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { PageTitle, Card } from "@/components/ui";

type Integration = {
  id: string;
  type: string;
  display_name: string | null;
  enabled: boolean;
};

export default function AdminPage() {
  const [token, setToken] = useState<string | null>(null);
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setToken(session.access_token);
    });
  }, []);

  useEffect(() => {
    if (!token) return;
    apiFetch("/api/v1/admin/integrations", { accessToken: token })
      .then((res) => res.ok ? res.json() : Promise.resolve({ items: [] }))
      .then((data: { items: Integration[] }) => setIntegrations(data.items || []))
      .catch(() => setIntegrations([]))
      .finally(() => setLoading(false));
  }, [token]);

  const activeCount = integrations.filter((i) => i.enabled).length;

  return (
    <div>
      <PageTitle
        title="Panel administracyjny"
        description="Zarządzaj integracjami i ustawieniami tenanta."
      />
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Link href="/admin/integrations" className="block">
          <Card className="p-4 hover:border-primary-300 transition-colors">
            <h2 className="font-semibold text-neutral-800">Integracje</h2>
            <p className="mt-1 text-sm text-neutral-600">
              Źródła danych (Bitrix24, Google Drive, Google Sheets) używane przez asystenta.
            </p>
            {!loading && (
              <p className="mt-2 text-sm text-neutral-500">
                {integrations.length} {integrations.length === 1 ? "integracja" : "integracji"}
                {activeCount > 0 && `, ${activeCount} aktywnych`}
              </p>
            )}
            <span className="mt-2 inline-block text-primary-600 text-sm font-medium">
              Zarządzaj integracjami →
            </span>
          </Card>
        </Link>
        <Link href="/chat" className="block">
          <Card className="p-4 hover:border-primary-300 transition-colors">
            <h2 className="font-semibold text-neutral-800">Chat</h2>
            <p className="mt-1 text-sm text-neutral-600">
              Rozmowa z asystentem na podstawie podłączonych źródeł.
            </p>
            <span className="mt-2 inline-block text-primary-600 text-sm font-medium">
              Otwórz chat →
            </span>
          </Card>
        </Link>
      </div>
    </div>
  );
}
