/**
 * Bitrix24 connector: inbound REST via Bitrix "Incoming webhook" URL.
 *
 * Credentials expected in config._credentials:
 * Incoming mode:
 * - webhook_url: string (e.g. https://<domain>.bitrix24.com/rest/<user_id>/<webhook_code>/)
 * - OR webhook parts: bitrix_domain + user_id + webhook_code
 *
 * Outgoing mode (events only):
 * - webhook_mode: "outgoing"
 * - application_token: string
 * Outgoing mode does not support REST queries for chat; it only allows storing the configuration.
 *
 * Server-only connector.
 */

import type { ConnectorInput, ConnectorOutput, Fragment, SourceMetadata } from "./contract";

function normalizeWebhookUrl(webhookUrl: string): string {
  let url = webhookUrl.trim();
  if (!url.endsWith("/")) url += "/";
  return url;
}

function getCredentials(config: Record<string, unknown>): Record<string, unknown> {
  // integrationsDomain.loadConfig injects decrypted credentials into `config._credentials`
  // but some callers may pass credentials directly.
  const creds = (config as any)._credentials ?? config;
  if (!creds || typeof creds !== "object") return {};
  return creds as Record<string, unknown>;
}

function getWebhookUrl(config: Record<string, unknown>): string {
  const creds = getCredentials(config);

  const mode = String(creds.webhook_mode ?? "incoming").toLowerCase();
  if (mode === "outgoing") {
    throw new Error("Outgoing webhook configured, but Incoming REST webhook is required for Bitrix adapter queries.");
  }

  // Option A (current): full inbound webhook URL
  const webhookUrl = creds.webhook_url;
  if (typeof webhookUrl === "string" && webhookUrl.trim().length > 0) {
    // Basic validation: must look like Bitrix REST inbound webhook.
    const normalized = normalizeWebhookUrl(webhookUrl);
    if (!/^https?:\/\//i.test(normalized) || !normalized.includes("/rest/")) {
      throw new Error("Invalid webhook_url format");
    }
    return normalized;
  }

  // Option B: pieces to build the inbound webhook base URL.
  // Expected fields (adapter-specific, stored in credentials_encrypted):
  // - bitrix_domain: e.g. my.bitrix24.com (may include scheme)
  // - user_id: e.g. 1
  // - webhook_code: e.g. abc123
  const bitrixDomain = creds.bitrix_domain ?? creds.domain;
  const userId = creds.user_id ?? creds.userId;
  const webhookCode = creds.webhook_code ?? creds.webhookCode;

  if (
    (typeof bitrixDomain !== "string" || bitrixDomain.trim().length === 0) ||
    (typeof userId !== "string" && typeof userId !== "number") ||
    (typeof webhookCode !== "string" || webhookCode.trim().length === 0)
  ) {
    throw new Error("Invalid Bitrix webhook credentials (webhook_url or bitrix_domain+user_id+webhook_code required)");
  }

  const userIdStr = String(userId).trim();
  const webhookCodeStr = String(webhookCode).trim();

  let base = String(bitrixDomain).trim().replace(/\/$/, "");
  if (!/^https?:\/\//i.test(base)) base = `https://${base}`;
  const built = `${base}/rest/${userIdStr}/${webhookCodeStr}/`;
  const normalized = normalizeWebhookUrl(built);
  if (!normalized.includes("/rest/")) throw new Error("Invalid Bitrix webhook_url format");
  return normalized;
}

async function bitrixJson(url: string, timeoutMs: number): Promise<any> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
    });
    const text = await res.text();
    try {
      return { ok: res.ok, status: res.status, json: JSON.parse(text) };
    } catch {
      return { ok: res.ok, status: res.status, json: null, text };
    }
  } finally {
    clearTimeout(t);
  }
}

function mapDeal(d: any): Fragment {
  const id = d?.ID ?? d?.id ?? null;
  const title = String(d?.TITLE ?? d?.title ?? "Bez tytułu").trim();
  const stage = d?.STAGE_ID ?? d?.stage ?? null;
  const opportunity = d?.OPPORTUNITY ?? d?.opportunity ?? null;
  const currency = d?.CURRENCY_ID ?? d?.currency_id ?? d?.CURRENCY ?? null;
  const dateCreate = d?.DATE_CREATE ?? d?.date_create ?? null;

  const amount =
    opportunity != null
      ? `${String(opportunity)}${currency ? ` ${String(currency)}` : ""}`
      : "";

  const bits = [
    id != null ? `Deal #${String(id)}` : "Deal",
    title,
    stage ? `stage: ${String(stage)}` : null,
    amount || null,
    dateCreate ? `created: ${String(dateCreate)}` : null,
  ].filter(Boolean);

  return {
    content: bits.join(" · "),
    metadata: { id: id ?? undefined },
  };
}

function mapContact(c: any): Fragment {
  const id = c?.ID ?? c?.id ?? null;
  const name = String(c?.NAME ?? "").trim();
  const lastName = String(c?.LAST_NAME ?? c?.LASTNAME ?? "").trim();
  const companyTitle = String(c?.COMPANY_TITLE ?? "").trim();

  const fullName = `${name} ${lastName}`.trim() || "Kontakt";
  const bits = [id != null ? `Contact #${String(id)}` : "Contact", fullName, companyTitle || null].filter(Boolean);

  const primaryEmail = c?.EMAIL?.[0]?.VALUE ?? c?.EMAIL ?? null;
  const emailBit = primaryEmail ? `email: ${String(primaryEmail)}` : null;
  if (emailBit) bits.push(emailBit);

  return {
    content: bits.join(" · "),
    metadata: { id: id ?? undefined },
  };
}

export class BitrixAdapter {
  async fetch(input: ConnectorInput): Promise<ConnectorOutput> {
    const creds = getCredentials(input.config);
    const mode = String(creds.webhook_mode ?? "incoming").toLowerCase();
    if (mode === "outgoing") {
      return {
        success: false,
        fragments: [],
        source_metadata: {
          source_id: "bitrix",
          type: "crm",
          title: "Bitrix24",
          link: null,
        },
        error: "Outgoing webhook configured (events). Incoming REST webhook is required to read CRM data.",
      };
    }

    const maxPerSource = input.limits.max_fragments_per_source;
    const limit = Math.max(1, Math.min(maxPerSource, 20));

    const source_metadata: SourceMetadata = {
      source_id: "bitrix",
      type: "crm",
      title: "Bitrix24",
      link: null,
    };

    let webhookUrl: string;
    try {
      webhookUrl = getWebhookUrl(input.config);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { success: false, fragments: [], source_metadata, error: msg };
    }

    const timeoutMs = Math.max(5000, input.limits.timeout_seconds * 1000);

    try {
      const fragments: Fragment[] = [];

      // 1) Deals
      if (fragments.length < limit) {
        const dealsUrl = `${webhookUrl}crm.deal.list.json?start=0&limit=${limit}`;
        const dealsRes = await bitrixJson(dealsUrl, timeoutMs);
        const deals = dealsRes.json?.result ?? dealsRes.json?.data ?? [];
        const dealItems = Array.isArray(deals) ? deals : [];
        for (const d of dealItems) {
          if (fragments.length >= limit) break;
          fragments.push(mapDeal(d));
        }
      }

      // 2) Contacts
      if (fragments.length < limit) {
        const remaining = limit - fragments.length;
        const contactsUrl = `${webhookUrl}crm.contact.list.json?start=0&limit=${remaining}`;
        const contactsRes = await bitrixJson(contactsUrl, timeoutMs);
        const contacts = contactsRes.json?.result ?? contactsRes.json?.data ?? [];
        const contactItems = Array.isArray(contacts) ? contacts : [];
        for (const c of contactItems) {
          if (fragments.length >= limit) break;
          fragments.push(mapContact(c));
        }
      }

      return { success: true, fragments, source_metadata, error: null };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return { success: false, fragments: [], source_metadata, error: msg.slice(0, 200) };
    }
  }

  async testConnection(config: Record<string, unknown>): Promise<{ ok: boolean; error?: string }> {
    const source_metadata: SourceMetadata = {
      source_id: "bitrix",
      type: "crm",
      title: "Bitrix24",
      link: null,
    };

    const creds = getCredentials(config);
    const mode = String(creds.webhook_mode ?? "incoming").toLowerCase();
    if (mode === "outgoing") {
      // Events-only configuration. We can't verify REST permissions here.
      // We'll accept the token as valid and let fetch() explain limitations.
      return { ok: true };
    }

    let webhookUrl: string;
    try {
      webhookUrl = getWebhookUrl(config);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { ok: false, error: msg };
    }

    const timeoutMs = 15_000;
    try {
      const url = `${webhookUrl}crm.deal.list.json?start=0&limit=1`;
      const res = await bitrixJson(url, timeoutMs);
      if (!res.ok) {
        const err = res.json?.error ?? res.json?.errors?.[0] ?? res.text ?? `HTTP ${res.status}`;
        return { ok: false, error: typeof err === "string" ? err : JSON.stringify(err) };
      }
      // If webhook is invalid, Bitrix sometimes returns {error: "..."} with 200 or 403.
      if (res.json?.error) {
        return { ok: false, error: String(res.json.error) };
      }
      return { ok: true };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return { ok: false, error: msg };
    } finally {
      // keep source_metadata referenced (no-op), prevents unused lint if enabled later
      void source_metadata;
    }
  }
}

