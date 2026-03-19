"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * /admin przekierowuje od razu do listy integracji (domyślny widok to czat).
 */
export default function AdminPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/admin/integrations");
  }, [router]);
  return (
    <div className="p-4">
      <p className="text-neutral-600">Przekierowanie…</p>
    </div>
  );
}
