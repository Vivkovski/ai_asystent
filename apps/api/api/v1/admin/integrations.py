"""Admin: integrations list, add, update (re-auth, disable)."""

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import JSONResponse

from core.deps import require_tenant_admin
from core.context import CurrentContext
from domain import integrations as domain
from domain import audit as audit_domain

router = APIRouter(prefix="/admin/integrations", tags=["admin-integrations"])


@router.get("")
def list_integrations(ctx: CurrentContext = Depends(require_tenant_admin)):
    """List current tenant integrations. No credentials."""
    data = domain.list_integrations(ctx.tenant_id)
    return {"items": data}


@router.post("")
def create_integration(
    body: dict,
    ctx: CurrentContext = Depends(require_tenant_admin),
):
    """
    Add integration: type (bitrix | google_drive | google_sheets), credentials (object), optional display_name.
    Test connection first; save only if OK. Returns 201 with row (no credentials).
    """
    type_ = body.get("type")
    credentials = body.get("credentials")
    display_name = body.get("display_name")
    if not type_ or not isinstance(credentials, dict):
        raise HTTPException(status_code=400, detail="type and credentials required")
    row, err = domain.create_integration(
        ctx.tenant_id, type_, credentials, display_name
    )
    if err:
        raise HTTPException(status_code=400, detail=err)
    try:
        audit_domain.log(
            ctx.tenant_id, ctx.user_id, "integration_connected",
            resource_type="integration", resource_id=row.get("id"),
            metadata={"type": type_},
        )
    except Exception:
        pass
    return JSONResponse(status_code=201, content=row)


@router.get("/{integration_id}")
def get_integration(
    integration_id: str,
    ctx: CurrentContext = Depends(require_tenant_admin),
):
    """Get one integration (no credentials)."""
    row = domain.get_integration(ctx.tenant_id, integration_id)
    if not row:
        raise HTTPException(status_code=404, detail="Not found")
    return row


@router.patch("/{integration_id}")
def update_integration(
  integration_id: str,
  body: dict,
  ctx: CurrentContext = Depends(require_tenant_admin),
):
    """
    Update: optional credentials (re-auth), optional enabled (bool).
    If credentials provided, test first then save.
    """
    credentials = body.get("credentials")
    enabled = body.get("enabled")
    if credentials is None and enabled is None:
        raise HTTPException(status_code=400, detail="Provide credentials and/or enabled")
    if credentials is not None and not isinstance(credentials, dict):
        raise HTTPException(status_code=400, detail="credentials must be object")
    row, err = domain.update_integration(
        ctx.tenant_id, integration_id, credentials=credentials, enabled=enabled
    )
    if err:
        raise HTTPException(status_code=400, detail=err)
    if enabled is False:
        try:
            audit_domain.log(
                ctx.tenant_id, ctx.user_id, "integration_disabled",
                resource_type="integration", resource_id=integration_id,
                metadata={},
            )
        except Exception:
            pass
    return row
