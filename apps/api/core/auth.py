"""JWT validation and profile loading. Returns CurrentContext or raises 401."""

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from config import settings
from core.context import CurrentContext

security = HTTPBearer(auto_error=False)


def _decode_supabase_jwt(token: str) -> dict:
    """Decode and verify Supabase JWT. Raises jwt.InvalidTokenError if invalid."""
    if not settings.supabase_jwt_secret:
        raise ValueError("SUPABASE_JWT_SECRET not set")
    return jwt.decode(
        token,
        settings.supabase_jwt_secret,
        algorithms=["HS256"],
        audience="authenticated",
        options={"verify_aud": True},
    )


async def get_current_context(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
) -> CurrentContext:
    """Validate JWT and load tenant_id, role from profiles. Return 401 if invalid or missing."""
    if not settings.supabase_jwt_secret:
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
