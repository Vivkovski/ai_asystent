"""Request context after auth: tenant_id, user_id, role."""

from typing import Literal


class CurrentContext:
    """Authenticated request context. Injected by auth dependency."""

    def __init__(
        self,
        *,
        tenant_id: str,
        user_id: str,
        role: Literal["end_user", "tenant_admin"],
    ) -> None:
        self.tenant_id = tenant_id
        self.user_id = user_id
        self.role = role

    @property
    def is_tenant_admin(self) -> bool:
        return self.role == "tenant_admin"
