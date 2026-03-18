"""Google Drive connector: OAuth (refresh_token), list/search files, return fragments."""

import asyncio

from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

from config import settings
from services.connectors.contract import (
    ConnectorInput,
    ConnectorOutput,
    Fragment,
    SourceMetadata,
)

DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.readonly"


def _credentials_from_config(config: dict):
    """Build Credentials from tenant config. Expects _credentials.refresh_token; uses app-level client id/secret."""
    creds_dict = config.get("_credentials") or config
    refresh_token = creds_dict.get("refresh_token")
    if not refresh_token:
        raise ValueError("refresh_token required")
    if not settings.google_client_id or not settings.google_client_secret:
        raise ValueError("Google OAuth not configured (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET)")
    creds = Credentials(
        token=None,
        refresh_token=refresh_token,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=settings.google_client_id,
        client_secret=settings.google_client_secret,
        scopes=[DRIVE_SCOPE],
    )
    creds.refresh(Request())
    return creds


def _fetch_sync(input: ConnectorInput) -> ConnectorOutput:
    limit = min(input.limits.max_fragments_per_source, 20)
    try:
        creds = _credentials_from_config(input.config)
        service = build("drive", "v3", credentials=creds)
        query = input.query_text.strip()
        if query:
            q = f"fullText contains '{query.replace(chr(39), chr(39)+chr(39))}'"
        else:
            q = None
        params = {
            "pageSize": limit,
            "fields": "files(id,name,webViewLink,mimeType)",
            "orderBy": "modifiedTime desc",
        }
        if q:
            params["q"] = q
        result = service.files().list(**params).execute()
        files = result.get("files") or []
        fragments = []
        for f in files[:limit]:
            name = f.get("name") or "(bez nazwy)"
            link = f.get("webViewLink") or f"https://drive.google.com/file/d/{f.get('id', '')}/view"
            content = f"{name}"
            fragments.append(
                Fragment(
                    content=content,
                    metadata={"id": f.get("id"), "link": link, "mimeType": f.get("mimeType")},
                )
            )
        return ConnectorOutput(
            success=True,
            fragments=fragments,
            source_metadata=SourceMetadata(
                source_id="google_drive",
                type="documents",
                title="Google Drive",
                link="https://drive.google.com",
            ),
            error=None,
        )
    except HttpError as e:
        msg = e.reason or str(e)
        if e.resp and e.resp.status in (401, 403):
            msg = "Błąd autoryzacji — połącz ponownie w panelu admin."
        return ConnectorOutput(
            success=False,
            fragments=[],
            source_metadata=SourceMetadata(
                source_id="google_drive",
                type="documents",
                title="Google Drive",
                link=None,
            ),
            error=msg[:200],
        )
    except Exception as e:
        return ConnectorOutput(
            success=False,
            fragments=[],
            source_metadata=SourceMetadata(
                source_id="google_drive",
                type="documents",
                title="Google Drive",
                link=None,
            ),
            error=str(e)[:200],
        )


class GoogleDriveAdapter:
    async def fetch(self, input: ConnectorInput) -> ConnectorOutput:
        return await asyncio.to_thread(_fetch_sync, input)

    def test_connection(self, config: dict) -> tuple[bool, str | None]:
        try:
            creds = _credentials_from_config(config)
            service = build("drive", "v3", credentials=creds)
            service.files().list(pageSize=1, fields="files(id)").execute()
            return True, None
        except Exception as e:
            msg = str(e)
            if "refresh_token" in msg or "credentials" in msg.lower():
                msg = "Nieprawidłowy refresh token — wykonaj ponownie połączenie z Google."
            return False, msg[:200]
