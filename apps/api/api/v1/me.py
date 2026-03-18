"""Protected route: current user context (for testing auth)."""

from fastapi import APIRouter, Depends

from core.auth import get_current_context
from core.context import CurrentContext

router = APIRouter(prefix="/me", tags=["me"])


@router.get("")
def me(ctx: CurrentContext = Depends(get_current_context)) -> dict:
    """Return current tenant_id, user_id, role. Requires valid JWT."""
    return {
        "tenant_id": ctx.tenant_id,
        "user_id": ctx.user_id,
        "role": ctx.role,
    }
