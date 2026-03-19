"use client";

// NEXT_PUBLIC_API_URL: brak = ten sam host, ścieżka /api/backend (Vercel Services lub proxy).
// Vercel Services wstrzykuje NEXT_PUBLIC_API_URL=/api/backend. Dwa projekty: ustaw pełny URL API.
// Dev: NEXT_PUBLIC_API_URL=http://127.0.0.1:8000.
const getApiBase = (): string => {
  const url = process.env.NEXT_PUBLIC_API_URL;
  if (url !== undefined && url !== "") return url;
  if (typeof window !== "undefined") return ""; // browser: same origin → relative /api/backend
  // SSR (Node): Vercel ustawia VERCEL_URL – budujemy absolutny URL do backendu
  if (typeof process !== "undefined" && process.env.VERCEL_URL)
    return `https://${process.env.VERCEL_URL}/api/backend`;
  return "http://127.0.0.1:8000"; // lokalny dev (SSR)
};

export async function apiFetch(
  path: string,
  options: RequestInit & { accessToken?: string } = {}
): Promise<Response> {
  const { accessToken, ...init } = options;
  const headers = new Headers(init.headers);
  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }
  headers.set("Content-Type", "application/json");
  const base = getApiBase();
  const url = base ? `${base}${path}` : `/api/backend${path}`;
  return fetch(url, { ...init, headers });
}
