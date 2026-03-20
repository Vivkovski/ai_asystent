"use client";

import { createClient } from "@/lib/supabase/client";
import { apiFetch } from "@/lib/api-client";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [role, setRole] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.replace("/login?redirect=/admin");
        return;
      }
      const token = session.access_token;
      try {
        const res = await apiFetch("/api/v1/me", { accessToken: token });
        if (res.status === 401) {
          let detail = "Błąd 401 z API.";
          try {
            const body = await res.json();
            if (body?.detail) detail = body.detail;
          } catch {
            /* ignore */
          }
          setApiError(`Backend 401: ${detail}`);
          setMounted(true);
          return;
        }
        if (!res.ok) {
          setApiError("Backend niedostępny. Sprawdź połączenie lub wdrożenie.");
          setMounted(true);
          return;
        }
        const text = await res.text();
        let data: { role?: string } = {};
        try {
          data = text ? JSON.parse(text) : {};
        } catch {
          setApiError("Nieprawidłowa odpowiedź z API.");
          setMounted(true);
          return;
        }
        setRole(data?.role === "tenant_admin" ? "tenant_admin" : "end_user");
      } catch {
        setApiError("Nie można połączyć z backendem.");
      } finally {
        setMounted(true);
      }
    })();
  }, [router]);

  useEffect(() => {
    const isGoogleCallback =
      pathname?.startsWith("/admin/integrations/google/callback") ?? false;
    if (mounted && role === "end_user" && !isGoogleCallback) {
      router.replace("/chat");
    }
  }, [mounted, role, router, pathname]);

  if (!mounted) {
    return (
      <main className="p-4">
        <p className="text-neutral-600">Ładowanie…</p>
      </main>
    );
  }

  if (apiError) {
    return (
      <main className="p-4">
        <p className="text-error mb-2">{apiError}</p>
        <a href="/chat" className="text-primary-600 hover:underline text-sm">Przejdź do chatu</a>
      </main>
    );
  }

  if (role === null) {
    return (
      <main className="p-4">
        <p className="text-neutral-600">Ładowanie…</p>
      </main>
    );
  }

  if (role === "end_user") {
    return (
      <main className="p-4">
        <p className="text-neutral-600">Przekierowanie…</p>
      </main>
    );
  }

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex">
      <aside className="w-56 border-r border-neutral-200 p-4 flex flex-col gap-2">
        <Link
          href="/admin/integrations"
          className={pathname?.startsWith("/admin/integrations") ? "font-semibold text-neutral-800" : "text-neutral-600 hover:text-primary-600"}
        >
          Integracje
        </Link>
        <div className="mt-auto flex flex-col gap-2">
          <Link href="/chat" className="text-sm text-neutral-600 hover:text-primary-600">
            ← Chat
          </Link>
          <button
            type="button"
            onClick={handleSignOut}
            className="text-left text-sm text-neutral-600 hover:text-primary-600"
          >
            Wyloguj
          </button>
        </div>
      </aside>
      <main className="flex-1 p-4">{children}</main>
    </div>
  );
}
