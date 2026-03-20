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
      const q = input.query_text.trim()
        ? `fullText contains '${input.query_text.trim().replace(/'/g, "''")}'`
        : undefined;
      const res = await drive.files.list({
        pageSize: limit,
        fields: "files(id,name,webViewLink,mimeType)",
        orderBy: "modifiedTime desc",
        q,
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
      });
      return { ok: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { ok: false, error: msg };
    }
  }
}
