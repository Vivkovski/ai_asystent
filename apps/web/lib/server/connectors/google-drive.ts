/**
 * Google Drive connector: OAuth (refresh_token), list files, return fragments. Server-only.
 */

import { google } from "googleapis";
import type {
  ConnectorInput,
  ConnectorOutput,
  Fragment,
  SourceMetadata,
} from "./contract";

const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.readonly";

function getCredentials(config: Record<string, unknown>): { refresh_token: string } {
  const creds = (config._credentials ?? config) as Record<string, unknown>;
  const refreshToken = creds.refresh_token;
  if (!refreshToken || typeof refreshToken !== "string") {
    throw new Error("refresh_token required");
  }
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Google OAuth not configured (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET)");
  }
  return { refresh_token: refreshToken };
}

export class GoogleDriveAdapter {
  async fetch(input: ConnectorInput): Promise<ConnectorOutput> {
    const limit = Math.min(input.limits.max_fragments_per_source, 20);
    const metadata: SourceMetadata = {
      source_id: "google_drive",
      type: "documents",
      title: "Google Drive",
      link: "https://drive.google.com",
    };
    try {
      const { refresh_token } = getCredentials(input.config);
      const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_OAUTH_REDIRECT_URI
      );
      oauth2Client.setCredentials({ refresh_token });
      const drive = google.drive({ version: "v3", auth: oauth2Client });
      const rawQuery = input.query_text.trim();

      // Fragments we return are file names (`f.name`).
      // Searching `fullText` with the whole user question (e.g. "jakie mam pliki w drive")
      // often produces zero results. Prefer `name contains` with a term extracted from the question.
      const stopWords = new Set([
        // Polish common words (used in listing-type questions)
        "jakie",
        "mam",
        "moje",
        "pliki",
        "plik",
        "foldery",
        "folder",
        "w",
        "na",
        "z",
        "do",
        "dysku",
        "dysk",
        "google",
        "drive",
        "czy",
        "pokaż",
        "pokaz",
        "wyniki",
        "lista",
        "podaj",
        "wymień",
        "wymien",
      ]);

      const tokens = rawQuery
        .toLowerCase()
        .replace(/[^a-z0-9ąćęłńóśźż]+/gi, " ")
        .split(/\s+/)
        .filter(Boolean);

      const meaningful = tokens.filter((t) => {
        if (stopWords.has(t)) return false;
        // Keep digits (e.g. "2025") and longer words.
        if (/^\d+$/.test(t)) return true;
        return t.length >= 3;
      });

      const term = meaningful.slice(0, 8).join(" ");
      const escapedTerm = term.replace(/'/g, "''");
      const q = term ? `name contains '${escapedTerm}' and trashed=false` : "trashed=false";
      const res = await drive.files.list({
        pageSize: limit,
        fields: "files(id,name,webViewLink,mimeType)",
        orderBy: "modifiedTime desc",
        q,
        corpora: "allDrives",
        // Allow access to shared drives (My Drive + Shared Drives)
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      });
      const files = res.data.files ?? [];
      const fragments: Fragment[] = files.slice(0, limit).map((f) => ({
        content: f.name ?? "(bez nazwy)",
        metadata: {
          id: f.id,
          link: f.webViewLink ?? `https://drive.google.com/file/d/${f.id}/view`,
          mimeType: f.mimeType,
        },
      }));
      return {
        success: true,
        fragments,
        source_metadata: metadata,
        error: null,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        fragments: [],
        source_metadata: { ...metadata, link: null },
        error: msg.slice(0, 200),
      };
    }
  }

  async testConnection(config: Record<string, unknown>): Promise<{ ok: boolean; error?: string }> {
    try {
      const { refresh_token } = getCredentials(config);
      const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_OAUTH_REDIRECT_URI
      );
      oauth2Client.setCredentials({ refresh_token });
      const drive = google.drive({ version: "v3", auth: oauth2Client });
      await drive.files.list({
        pageSize: 1,
        fields: "files(id)",
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
        corpora: "allDrives",
      });
      return { ok: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { ok: false, error: msg };
    }
  }
}
