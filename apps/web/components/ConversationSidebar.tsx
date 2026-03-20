"use client";

import { createClient } from "@/lib/supabase/client";
import { apiFetch } from "@/lib/api-client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type Conversation = {
  id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
};

export default function ConversationSidebar({
  activeConversationId,
}: {
  activeConversationId?: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const [token, setToken] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loadingNew, setLoadingNew] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) return;
      setToken(session.access_token);
      setMounted(true);
    });
  }, []);

  const fetchConversations = useCallback(() => {
    if (!token) return;
    apiFetch("/api/v1/conversations", { accessToken: token })
      .then((r) => r.json())
      .then((data: { items: Conversation[] }) => setConversations(data.items || []))
      .catch(() => setConversations([]));
  }, [token]);

  useEffect(() => {
    if (!mounted || !token) return;
    fetchConversations();
  }, [mounted, token, fetchConversations]);

  const handleNewConversation = async () => {
    if (!token) return;
    setLoadingNew(true);
    setError(null);
    try {
      const r = await apiFetch("/api/v1/conversations", {
        method: "POST",
        accessToken: token,
        body: JSON.stringify({}),
      });

      if (!r.ok) {
        const text = await r.text();
        let msg = r.statusText;
        try {
          const j = JSON.parse(text) as { message?: string; detail?: string };
          const human = typeof j.message === "string" ? j.message : "";
          const tech = typeof j.detail === "string" ? j.detail : "";
          msg = tech ? (human ? `${human} — ${tech}` : tech) : human || msg;
        } catch {
          if (r.status === 404) msg = "Backend niedostępny (404). Sprawdź wdrożenie.";
        }
        throw new Error(msg);
      }

      const conv = (await r.json()) as Conversation;
      router.replace(`/chat?conversationId=${conv.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Wystąpił błąd");
    } finally {
      setLoadingNew(false);
    }
  };

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  const isIntegrations = pathname?.startsWith("/integrations");

  return (
    <aside className="w-60 flex-shrink-0 flex flex-col bg-white border-r border-neutral-200">
      <div className="p-3">
        <button
          type="button"
          onClick={handleNewConversation}
          disabled={loadingNew}
          className="w-full rounded-lg bg-neutral-900 text-white py-2.5 text-sm font-medium hover:bg-neutral-800 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <span className="text-base leading-none">+</span>
          Nowa rozmowa
        </button>
        {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      </div>

      <div className="flex-1 overflow-auto min-h-0 px-2">
        <p className="px-2 py-1.5 text-xs font-medium text-neutral-400 uppercase tracking-wider">
          Rozmowy
        </p>
        <ul className="space-y-0.5 pb-2">
          {conversations.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => router.replace(`/chat?conversationId=${c.id}`)}
                className={`w-full text-left px-3 py-2.5 rounded-lg text-sm truncate transition-colors ${
                  activeConversationId === c.id
                    ? "bg-neutral-100 text-neutral-900 font-medium"
                    : "text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900"
                }`}
              >
                {c.title || "Nowa rozmowa"}
              </button>
            </li>
          ))}
        </ul>
      </div>

      <nav className="border-t border-neutral-100 p-2 space-y-0.5">
        <Link
          href="/integrations"
          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            isIntegrations
              ? "text-neutral-800 bg-neutral-100"
              : "text-neutral-700 hover:bg-neutral-50 hover:text-neutral-900"
          }`}
        >
          <span className="text-neutral-500 aria-hidden">⚙</span>
          Integracje
        </Link>
        <button
          type="button"
          onClick={handleSignOut}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-neutral-700 hover:bg-neutral-50 hover:text-neutral-900 transition-colors"
        >
          <span className="text-neutral-500 aria-hidden">↪</span>
          Wyloguj
        </button>
      </nav>
    </aside>
  );
}

