"""FastAPI dependencies: auth and role guards."""

from fastapi import Depends, HTTPException, status

from core.auth import get_current_context
from core.context import CurrentContext


async def require_tenant_admin(
    ctx: CurrentContext = Depends(get_current_context),
) -> CurrentContext:
    """Require tenant_admin role. Raises 403 for end_user."""
    if not ctx.is_tenant_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return ctx
