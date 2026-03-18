"use client";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

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
  return fetch(`${API_BASE}${path}`, { ...init, headers });
}
