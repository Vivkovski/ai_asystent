"""Tenant isolation: API must pass correct tenant_id/user_id to domain; no cross-tenant data."""

from unittest.mock import patch

import pytest

from domain import chat as chat_domain
from domain import integrations as integrations_domain


def test_list_conversations_uses_context_tenant_and_user(client, ctx_a, override_auth, tenant_a, user_a):
    """List conversations must be called with tenant_id and user_id from context."""
    with patch.object(chat_domain, "list_conversations", return_value=[]) as list_conv:
        r = client.get("/api/v1/conversations")
        assert r.status_code == 200
        list_conv.assert_called_once()
        call_kw = list_conv.call_args
        assert call_kw[0][0] == tenant_a
        assert call_kw[0][1] == user_a


def test_get_conversation_uses_context_tenant_and_user(client, ctx_b, override_auth_b, tenant_b, user_b):
    """Get conversation must use ctx tenant_id and user_id so RLS/domain filters by tenant."""
    with patch.object(chat_domain, "get_conversation", return_value=None):
        r = client.get("/api/v1/conversations/some-uuid")
        assert r.status_code == 404
        chat_domain.get_conversation.assert_called_once()
        args = chat_domain.get_conversation.call_args[0]
        assert args[0] == tenant_b
        assert args[1] == user_b


def test_admin_list_integrations_uses_context_tenant(client, ctx_a, override_auth, tenant_a):
    """Admin integrations list must be scoped to context tenant_id."""
    with patch.object(integrations_domain, "list_integrations", return_value=[]) as list_int:
        r = client.get("/api/v1/admin/integrations")
        assert r.status_code == 200
        list_int.assert_called_once_with(tenant_a)
