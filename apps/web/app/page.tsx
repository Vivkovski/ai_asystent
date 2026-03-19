"use client";

import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const hasSupabaseEnv =
  typeof process.env.NEXT_PUBLIC_SUPABASE_URL === "string" &&
  process.env.NEXT_PUBLIC_SUPABASE_URL.length > 0 &&
  typeof process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY === "string" &&
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.length > 0;

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
      {!hasSupabaseEnv && (
        <p className="mt-4 text-sky-800 text-sm bg-sky-50 border border-sky-200 rounded px-3 py-2">
          Tryb mock (lokalny dev bez Supabase). Zaloguj się dowolnym emailem i hasłem.
        </p>
      )}
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
