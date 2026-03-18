"use client";

import { createClient } from "@/lib/supabase/client";
import { apiFetch } from "@/lib/api-client";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";

type Conversation = { id: string; title: string | null; created_at: string; updated_at: string };
type SourceItem = { id: number; type: string; title: string; link: string | null; unavailable?: boolean };
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
  const [mounted, setMounted] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  useEffect(() => {
    if (!mounted || !token) return;
    fetchConversations();
  }, [mounted, token, fetchConversations]);

  useEffect(() => {
    if (currentId && token) fetchMessages(currentId);
    else setMessages([]);
  }, [currentId, token, fetchMessages]);

  const handleNewConversation = () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    apiFetch("/api/v1/conversations", {
      method: "POST",
      accessToken: token,
      body: JSON.stringify({}),
    })
      .then((r) => r.json())
      .then((conv: Conversation) => {
        setCurrentId(conv.id);
        setConversations((prev) => [conv, ...prev]);
        setMessages([]);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || !token) return;
    let convId = currentId;
    if (!convId) {
      const r = await apiFetch("/api/v1/conversations", {
        method: "POST",
        accessToken: token,
        body: JSON.stringify({}),
      });
      const conv = await r.json();
      convId = conv.id;
      setCurrentId(convId);
      setConversations((prev) => [conv, ...prev]);
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
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || res.statusText);
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

  return (
    <div className="flex h-screen">
      <aside className="w-64 border-r border-neutral-200 flex flex-col">
        <div className="p-2 border-b border-neutral-200">
          <button
            type="button"
            onClick={handleNewConversation}
            disabled={loading}
            className="w-full rounded bg-primary-600 text-white py-2 text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
          >
            Nowa rozmowa
          </button>
        </div>
        <ul className="flex-1 overflow-auto p-2">
          {conversations.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => setCurrentId(c.id)}
                className={`w-full text-left px-3 py-2 rounded text-sm truncate ${currentId === c.id ? "bg-neutral-200" : "hover:bg-neutral-100"}`}
              >
                {c.title || "Nowa rozmowa"}
              </button>
            </li>
          ))}
        </ul>
      </aside>
      <main className="flex-1 flex flex-col min-w-0">
        <div className="border-b border-neutral-200 p-2">
          <h1 className="text-lg font-semibold text-neutral-800">Chat</h1>
        </div>
        <div className="flex-1 overflow-auto p-4 space-y-4">
          {messages.length === 0 && !currentId && (
            <p className="text-neutral-500">Rozpocznij nową rozmowę lub wybierz istniejącą z listy.</p>
          )}
          {messages.map((m) => (
            <div key={m.id || m.created_at} className={m.role === "user" ? "text-right" : ""}>
              <div className={`inline-block max-w-[85%] rounded-lg px-4 py-2 text-left ${m.role === "user" ? "bg-primary-100" : "bg-neutral-100"}`}>
                <p className="whitespace-pre-wrap">{m.content}</p>
                {m.role === "assistant" && m.sources && m.sources.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-neutral-200">
                    <p className="text-xs font-medium text-neutral-600 mb-1">Źródła</p>
                    <ul className="text-sm space-y-1">
                      {m.sources.map((s) => (
                        <li key={s.id}>
                          {s.link ? (
                            <a href={s.link} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline">
                              [{s.id}] {s.title}{s.unavailable ? " (niedostępne)" : ""}
                            </a>
                          ) : (
                            <span>[{s.id}] {s.title}{s.unavailable ? " (niedostępne)" : ""}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          ))}
          {loading && <p className="text-neutral-500 text-sm">Asystent odpowiada…</p>}
        </div>
        {error && <p className="px-4 py-2 text-sm text-error">{error}</p>}
        <form onSubmit={handleSubmit} className="p-4 border-t border-neutral-200">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Zadaj pytanie…"
              className="flex-1 border border-neutral-200 rounded px-3 py-2"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="rounded bg-primary-600 text-white px-4 py-2 font-medium disabled:opacity-50 hover:bg-primary-700"
            >
              Wyślij
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
