"use client";

// Gdy brak NEXT_PUBLIC_API_URL = ten sam host, backend pod /api/backend (jeden projekt Vercel).
// W dev ustaw NEXT_PUBLIC_API_URL=http://127.0.0.1:8000. Na Vercel nie ustawiaj = używamy relative /api/backend.
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
