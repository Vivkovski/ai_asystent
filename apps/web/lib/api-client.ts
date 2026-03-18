"use client";

// Gdy brak NEXT_PUBLIC_API_URL = ten sam host, backend pod /api/backend (jeden projekt Vercel).
// W dev lub przy osobnym API ustaw NEXT_PUBLIC_API_URL (np. http://127.0.0.1:8000).
const getApiBase = (): string => {
  const url = process.env.NEXT_PUBLIC_API_URL;
  if (url !== undefined && url !== "") return url;
  if (typeof window !== "undefined") return ""; // browser: same origin
  return "http://127.0.0.1:8000"; // SSR fallback
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
