"use client";

import { createClient } from "@/lib/supabase/client";
import { apiFetch } from "@/lib/api-client";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useEffect, useState, useCallback } from "react";

type Conversation = { id: string; title: string | null; created_at: string; updated_at: string };
type SourceItem = { id: number; type: string; title: string; link: string | null; unavailable?: boolean };
type IntegrationTile = { id: string; type: string; display_name: string | null; enabled: boolean };
type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  status?: string;
  sources?: SourceItem[];
  created_at: string;
};

export default function ChatPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const conversationIdFromQuery = searchParams.get("conversationId");
  const [mounted, setMounted] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [integrations, setIntegrations] = useState<IntegrationTile[]>([]);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.replace("/login?redirect=/chat");
        return;
      }
      setToken(session.access_token);
      setMounted(true);
    });
  }, [router]);

  const fetchConversations = useCallback(() => {
    if (!token) return;
    apiFetch("/api/v1/conversations", { accessToken: token })
      .then((r) => r.json())
      .then((data: { items: Conversation[] }) => setConversations(data.items || []))
      .catch(() => setConversations([]));
  }, [token]);

  const fetchMessages = useCallback((convId: string) => {
    if (!token) return;
    apiFetch(`/api/v1/conversations/${convId}`, { accessToken: token })
      .then((r) => r.json())
      .then((data: { messages?: Message[] }) => setMessages(data.messages || []))
      .catch(() => setMessages([]));
  }, [token]);

  const fetchIntegrations = useCallback(() => {
    if (!token) return;
    apiFetch("/api/v1/integrations", { accessToken: token })
      .then((r) => r.ok ? r.json() : Promise.resolve({ items: [] }))
      .then((data: { items: IntegrationTile[] }) => setIntegrations(data.items || []))
      .catch(() => setIntegrations([]));
  }, [token]);

  useEffect(() => {
    if (!mounted || !token) return;
    fetchConversations();
    fetchIntegrations();
  }, [mounted, token, fetchConversations, fetchIntegrations]);

  useEffect(() => {
    if (currentId && token) fetchMessages(currentId);
    else setMessages([]);
  }, [currentId, token, fetchMessages]);

  useEffect(() => {
    // When opening `/chat?conversationId=...` (e.g. from integrations sidebar),
    // sync current conversation id once after mount.
    if (mounted && conversationIdFromQuery && !currentId) {
      setCurrentId(conversationIdFromQuery);
    }
  }, [mounted, conversationIdFromQuery, currentId]);

  const handleNewConversation = () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    apiFetch("/api/v1/conversations", {
      method: "POST",
      accessToken: token,
      body: JSON.stringify({}),
    })
      .then(async (r) => {
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
        return r.json() as Promise<Conversation>;
      })
      .then((conv) => {
        setCurrentId(conv.id);
        setConversations((prev) => [conv, ...prev]);
        setMessages([]);
        router.replace(`/chat?conversationId=${conv.id}`);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Wystąpił błąd"))
      .finally(() => setLoading(false));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!token) {
      setError("Sesja wygasła. Odśwież stronę lub wyloguj i zaloguj się ponownie.");
      return;
    }
    if (!text) return;
    let convId = currentId;
    if (!convId) {
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
        setError(msg);
        setLoading(false);
        return;
      }
      const conv = await r.json() as Conversation;
      convId = conv.id;
      setCurrentId(convId);
      setConversations((prev) => [conv, ...prev]);
      router.replace(`/chat?conversationId=${convId}`);
    }
    setInput("");
    setMessages((prev) => [...prev, { id: "", role: "user", content: text, created_at: new Date().toISOString() }]);
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/v1/conversations/${convId}/messages`, {
        method: "POST",
        accessToken: token,
        body: JSON.stringify({ content: text }),
      });
      let data: { message?: Message | string; detail?: string };
      try {
        data = await res.json();
      } catch {
        setError(res.status === 404 ? "Backend niedostępny (404). Sprawdź wdrożenie." : res.statusText || "Błąd sieci.");
        setMessages((prev) => prev.filter((m) => m.role !== "user" || m.content !== text));
        setLoading(false);
        return;
      }
      if (!res.ok) {
        const errMsg =
          typeof data?.detail === "string"
            ? data.detail
            : typeof data?.message === "string"
              ? data.message
              : res.statusText || "Błąd";
        throw new Error(errMsg);
      }
      const msg = data.message as Message;
      setMessages((prev) => [...prev, { ...msg, id: msg.id, role: "assistant", created_at: msg.created_at }]);
      fetchConversations();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Wystąpił błąd");
      setMessages((prev) => prev.filter((m) => m.role !== "user" || m.content !== text));
    } finally {
      setLoading(false);
    }
  };

  if (!mounted) return <main className="p-4"><p className="text-neutral-600">Ładowanie…</p></main>;

  const isEmpty = messages.length === 0 && !currentId;
  const enabledIntegrations = integrations.filter((i) => i.enabled);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <div className="flex h-screen bg-neutral-50">
      {/* Sidebar — wzór ChatGPT/Claude */}
      <aside className="w-60 flex-shrink-0 flex flex-col bg-white border-r border-neutral-200">
        <div className="p-3">
          <button
            type="button"
            onClick={handleNewConversation}
            disabled={loading}
            className="w-full rounded-lg bg-neutral-900 text-white py-2.5 text-sm font-medium hover:bg-neutral-800 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <span className="text-base leading-none">+</span>
            Nowa rozmowa
          </button>
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
                  onClick={() => {
                    setCurrentId(c.id);
                    router.replace(`/chat?conversationId=${c.id}`);
                  }}
                  className={`w-full text-left px-3 py-2.5 rounded-lg text-sm truncate transition-colors ${currentId === c.id ? "bg-neutral-100 text-neutral-900 font-medium" : "text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900"}`}
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
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-neutral-700 hover:bg-neutral-50 hover:text-neutral-900 transition-colors"
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

      {/* Główny obszar czatu */}
      <main className="flex-1 flex flex-col min-w-0">
        {isEmpty ? (
          /* Pusty stan — wycentrowany jak w GPT/Claude */
          <div className="flex-1 flex flex-col items-center justify-center px-4 pb-8">
            <h2 className="text-2xl font-semibold text-neutral-800 text-center mb-1">
              Cześć, w czym mogę pomóc?
            </h2>
            <p className="text-neutral-500 text-sm text-center mb-8">
              Zadaj pytanie na podstawie podłączonych źródeł.
            </p>
            {enabledIntegrations.length > 0 && (
              <div className="flex flex-wrap justify-center gap-2 mb-8 max-w-xl">
                {enabledIntegrations.map((i) => (
                  <span
                    key={i.id}
                    className="inline-flex items-center rounded-full bg-white border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-600 shadow-sm"
                    title={i.display_name || i.type}
                  >
                    {i.display_name || i.type}
                  </span>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* Lista wiadomości — wycentrowana kolumna */
          <div className="flex-1 overflow-auto">
            <div className="mx-auto max-w-3xl py-6 px-4">
              {messages.map((m) => (
                <div
                  key={m.id || m.created_at}
                  className={`flex ${m.role === "user" ? "justify-end" : "justify-start"} mb-6`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-3 text-left ${
                      m.role === "user"
                        ? "bg-primary-600 text-white"
                        : "bg-white border border-neutral-200 shadow-sm"
                    }`}
                  >
                    <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{m.content}</p>
                    {m.role === "assistant" && m.sources && m.sources.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-neutral-200">
                        <p className="text-xs font-medium text-neutral-500 mb-1">Źródła</p>
                        <ul className="text-sm space-y-1">
                          {m.sources.map((s) => (
                            <li key={s.id}>
                              {s.link ? (
                                <a
                                  href={s.link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-primary-600 hover:underline"
                                >
                                  [{s.id}] {s.title}
                                  {s.unavailable ? " (niedostępne)" : ""}
                                </a>
                              ) : (
                                <span>
                                  [{s.id}] {s.title}
                                  {s.unavailable ? " (niedostępne)" : ""}
                                </span>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start mb-6">
                  <div className="rounded-2xl bg-white border border-neutral-200 shadow-sm px-4 py-3 text-neutral-500 text-sm">
                    Asystent odpowiada…
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {error && (
          <div className="mx-auto max-w-3xl px-4 py-2">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* Pole wpisu na dole — styl GPT/Claude */}
        <div className="flex-shrink-0 p-4">
          <form onSubmit={handleSubmit} className="mx-auto max-w-3xl">
            <div className="flex gap-2 rounded-2xl border border-neutral-200 bg-white p-2 shadow-sm focus-within:border-primary-400 focus-within:ring-2 focus-within:ring-primary-100">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Zadaj pytanie…"
                className="flex-1 bg-transparent px-4 py-3 text-[15px] placeholder:text-neutral-400 outline-none"
                disabled={loading}
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="rounded-xl bg-primary-600 text-white px-4 py-2.5 text-sm font-medium hover:bg-primary-700 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
              >
                Wyślij
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
