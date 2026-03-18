/**
 * Proxy do funkcji Pythona na Vercel.
 * Żądania /api/backend/* są przekierowywane na /api/python-api/*,
 * gdzie odpowiada serverless function z api/python-api.py.
 */
import { NextRequest, NextResponse } from "next/server";

const PYTHON_API_PREFIX = "/api/python-api";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> }
) {
  return proxy(request, await params);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> }
) {
  return proxy(request, await params);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> }
) {
  return proxy(request, await params);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> }
) {
  return proxy(request, await params);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> }
) {
  return proxy(request, await params);
}

async function proxy(
  request: NextRequest,
  params: { path?: string[] }
): Promise<NextResponse> {
  const pathSegments = params.path ?? [];
  const path = pathSegments.length ? `/${pathSegments.join("/")}` : "";
  const targetPath = `${PYTHON_API_PREFIX}${path}`;
  const base =
    process.env.VERCEL_URL != null
      ? `https://${process.env.VERCEL_URL}`
      : request.nextUrl.origin;
  const url = `${base}${targetPath}${request.nextUrl.search}`;

  const headers = new Headers(request.headers);
  headers.delete("connection");
  headers.set("host", new URL(base).host);

  const init: RequestInit = {
    method: request.method,
    headers,
  };
  if (request.body != null && ["POST", "PUT", "PATCH"].includes(request.method)) {
    init.body = await request.arrayBuffer();
  }

  try {
    const res = await fetch(url, init);
    const body = await res.arrayBuffer();
    return new NextResponse(body, {
      status: res.status,
      statusText: res.statusText,
      headers: res.headers,
    });
  } catch (e) {
    console.error("Proxy to python-api failed:", e);
    return NextResponse.json(
      { detail: "Backend unavailable" },
      { status: 502 }
    );
  }
}
