"""Google OAuth: authorize URL + callback (exchange code for refresh_token, create integration)."""

import json
import time
import uuid
import urllib.error
import urllib.parse
import urllib.request

from fastapi import APIRouter, Depends, HTTPException, status

from config import settings
from core.deps import require_tenant_admin
from core.context import CurrentContext
from domain import integrations as domain
from domain import audit as audit_domain

# Scope for Drive read-only; same as in google_drive connector
GOOGLE_DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.readonly"

router = APIRouter(prefix="/admin/integrations/google", tags=["admin-google-oauth"])

# In-memory state store: state -> created_at. TTL 600s. For multi-worker use Redis.
_oauth_state: dict[str, float] = {}
_STATE_TTL = 600


def _validate_redirect_uri() -> str:
    if not settings.google_oauth_redirect_uri:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="GOOGLE_OAUTH_REDIRECT_URI not configured",
        )
    return settings.google_oauth_redirect_uri.strip()


@router.get("/authorize-url")
def get_authorize_url(ctx: CurrentContext = Depends(require_tenant_admin)):
    """
    Return Google OAuth2 authorize URL. Frontend redirects user there;
    after login Google redirects to redirect_uri with ?code=...&state=...
    """
    if not settings.google_client_id:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Google OAuth not configured (GOOGLE_CLIENT_ID)",
        )
    redirect_uri = _validate_redirect_uri()
    state = uuid.uuid4().hex
    _oauth_state[state] = time.time()
    # Clean old entries
    now = time.time()
    for s in list(_oauth_state.keys()):
        if now - _oauth_state[s] > _STATE_TTL:
            del _oauth_state[s]
    scope = GOOGLE_DRIVE_SCOPE
    url = (
        "https://accounts.google.com/o/oauth2/v2/auth"
        f"?client_id={urllib.parse.quote(settings.google_client_id)}"
        f"&redirect_uri={urllib.parse.quote(redirect_uri)}"
        "&response_type=code"
        f"&scope={urllib.parse.quote(scope)}"
        f"&state={state}"
        "&access_type=offline"
        "&prompt=consent"
    )
    return {"url": url, "state": state}


@router.post("/callback")
def google_oauth_callback(
    body: dict,
    ctx: CurrentContext = Depends(require_tenant_admin),
):
    """
    Exchange code for tokens and create google_drive integration.
    Body: { "code": "...", "state": "..." }. Optional: "display_name", "type" (google_drive | google_sheets).
    """
    code = body.get("code") if isinstance(body, dict) else None
    state = body.get("state") if isinstance(body, dict) else None
    if not code or not state:
        raise HTTPException(status_code=400, detail="code and state required")
    now = time.time()
    if state not in _oauth_state:
        raise HTTPException(status_code=400, detail="Invalid or expired state")
    if now - _oauth_state[state] > _STATE_TTL:
        del _oauth_state[state]
        raise HTTPException(status_code=400, detail="State expired")
    del _oauth_state[state]

    if not settings.google_client_id or not settings.google_client_secret:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Google OAuth not configured",
        )
    redirect_uri = _validate_redirect_uri()

    # Exchange code for tokens
    data = (
        f"code={urllib.parse.quote(code)}"
        f"&client_id={urllib.parse.quote(settings.google_client_id)}"
        f"&client_secret={urllib.parse.quote(settings.google_client_secret)}"
        f"&redirect_uri={urllib.parse.quote(redirect_uri)}"
        "&grant_type=authorization_code"
    ).encode("utf-8")
    req = urllib.request.Request(
        "https://oauth2.googleapis.com/token",
        data=data,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            token_data = json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        body_err = e.read().decode() if e.fp else ""
        try:
            err_json = json.loads(body_err)
            msg = err_json.get("error_description") or err_json.get("error") or body_err
        except Exception:
            msg = body_err or str(e)
        raise HTTPException(status_code=400, detail=f"Token exchange failed: {msg[:200]}")
    except Exception as e:
        raise HTTPException(status_code=502, detail="Token exchange request failed")

    refresh_token = token_data.get("refresh_token")
    if not refresh_token:
        raise HTTPException(
            status_code=400,
            detail="Google did not return refresh_token. Revoke app access and try again with prompt=consent.",
        )

    integration_type = (body.get("type") or "google_drive") if isinstance(body, dict) else "google_drive"
    if integration_type not in ("google_drive", "google_sheets"):
        integration_type = "google_drive"
    display_name = body.get("display_name") if isinstance(body, dict) else None

    row, err = domain.create_integration(
        ctx.tenant_id,
        integration_type,
        {"refresh_token": refresh_token},
        display_name,
    )
    if err:
        raise HTTPException(status_code=400, detail=err)
    try:
        audit_domain.log(
            ctx.tenant_id, ctx.user_id, "integration_connected",
            resource_type="integration", resource_id=row.get("id"),
            metadata={"type": integration_type},
        )
    except Exception:
        pass
    return {"integration": row, "success": True}
