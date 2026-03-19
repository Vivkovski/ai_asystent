"use client";

import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        router.replace("/chat");
        return;
      }
      setMounted(true);
    });
  }, [router]);

  if (!mounted) {
    return (
      <main className="p-6 max-w-xl mx-auto">
        <p className="text-neutral-600">Ładowanie…</p>
      </main>
    );
  }

  return (
    <main className="p-6 max-w-xl mx-auto">
      <h1 className="text-2xl font-semibold text-neutral-800">AI Assistant</h1>
      <p className="text-neutral-600 mt-2">
        Asystent dla firm — odpowiedzi na podstawie podłączonych źródeł (CRM, dokumenty, arkusze).
      </p>
      <div className="mt-6">
        <Link
          href="/login"
          className="inline-block bg-primary-600 text-white text-sm font-medium py-2 px-4 rounded hover:bg-primary-700"
        >
          Zaloguj się
        </Link>
      </div>
    </main>
  );
}
