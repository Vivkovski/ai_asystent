"use client";

import { createClient } from "@/lib/supabase/client";
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

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.replace("/login?redirect=/admin");
        return;
      }
      // Role check: call API /api/v1/me to get role; if not tenant_admin redirect
      const token = session.access_token;
      try {
        const res = await fetch((process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000") + "/api/v1/me", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.status === 401) {
          router.replace("/login?redirect=/admin");
          return;
        }
        const data = await res.json();
        if (data?.role === "tenant_admin") {
          setRole("tenant_admin");
        } else {
          router.replace("/chat");
        }
      } catch {
        router.replace("/login?redirect=/admin");
      } finally {
        setMounted(true);
      }
    })();
  }, [router]);

  if (!mounted || role !== "tenant_admin") {
    return (
      <main className="p-4">
        <p>Ładowanie…</p>
      </main>
    );
  }

  return (
    <div className="min-h-screen flex">
      <aside className="w-56 border-r p-4 flex flex-col gap-2">
        <Link
          href="/admin"
          className={pathname === "/admin" ? "font-semibold" : ""}
        >
          Panel
        </Link>
        <Link
          href="/admin/integrations"
          className={pathname === "/admin/integrations" ? "font-semibold" : ""}
        >
          Integracje
        </Link>
        <Link href="/chat" className="mt-auto text-sm text-gray-600">
          ← Chat
        </Link>
      </aside>
      <main className="flex-1 p-4">{children}</main>
    </div>
  );
}
