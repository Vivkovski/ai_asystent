"use client";

// Single Next.js app: API under /api (same origin). NEXT_PUBLIC_API_URL only for external API if needed.
const getApiBase = (): string => {
  const url = process.env.NEXT_PUBLIC_API_URL;
  if (url !== undefined && url !== "") return url;
  return "/api"; // same origin
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
  let pathNorm = path.startsWith("/") ? path : `/${path}`;
  if (base === "/api" && pathNorm.startsWith("/api/")) pathNorm = pathNorm.slice(4);
  const url = `${base.replace(/\/$/, "")}${pathNorm}`;
  return fetch(url, { ...init, headers });
}
