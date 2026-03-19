"""JWT validation and profile loading. Returns CurrentContext or raises 401."""

import jwt
from jwt import PyJWKClient
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from config import settings
from core.context import CurrentContext

security = HTTPBearer(auto_error=False)

_jwks_client: PyJWKClient | None = None


def _get_jwks_client() -> PyJWKClient:
    global _jwks_client
    if _jwks_client is None:
        base = (settings.supabase_url or "").rstrip("/")
        if not base:
            raise ValueError("SUPABASE_URL not set (required for ES256 JWKS)")
        _jwks_client = PyJWKClient(f"{base}/auth/v1/.well-known/jwks")
    return _jwks_client


def _decode_supabase_jwt(token: str) -> dict:
    """Decode and verify Supabase JWT. Supports HS256 (secret) or ES256 (JWKS). Raises jwt.InvalidTokenError if invalid."""
    if settings.supabase_jwt_secret:
        return jwt.decode(
            token,
            settings.supabase_jwt_secret,
            algorithms=["HS256"],
            audience="authenticated",
            options={"verify_aud": True},
        )
    if settings.supabase_url:
        jwks = _get_jwks_client()
        signing_key = jwks.get_signing_key_from_jwt(token)
        return jwt.decode(
            token,
            signing_key.key,
            algorithms=["ES256"],
            audience="authenticated",
            options={"verify_aud": True},
        )
    raise ValueError("Set SUPABASE_JWT_SECRET (HS256) or SUPABASE_URL (ES256 via JWKS)")


async def get_current_context(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
) -> CurrentContext:
    """Validate JWT and load tenant_id, role from profiles. Return 401 if invalid or missing."""
    auth_configured = bool(settings.supabase_jwt_secret or settings.supabase_url)
    if not auth_configured:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Auth not configured",
        )
    if not credentials or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid authorization",
        )
    token = credentials.credentials
    try:
        payload = _decode_supabase_jwt(token)
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
        )

    # Load profile (tenant_id, role) from DB via Supabase client.
    if settings.supabase_url and settings.supabase_key:
        from supabase import create_client

        client = create_client(settings.supabase_url, settings.supabase_key)
        r = client.table("profiles").select("tenant_id,role").eq("id", user_id).maybe_single().execute()
        if not r.data:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Profile not found",
            )
        tenant_id = r.data["tenant_id"]
        role = r.data["role"]
    else:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Profile not found (Supabase not configured)",
        )

    if role not in ("end_user", "tenant_admin"):
        role = "end_user"

    return CurrentContext(tenant_id=str(tenant_id), user_id=str(user_id), role=role)
