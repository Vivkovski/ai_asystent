"""Pytest fixtures: app, client, overridden auth context."""

import uuid

import pytest
from fastapi.testclient import TestClient

from main import app
from core.auth import get_current_context
from core.context import CurrentContext


@pytest.fixture
def tenant_a():
    return str(uuid.uuid4())


@pytest.fixture
def tenant_b():
    return str(uuid.uuid4())


@pytest.fixture
def user_a():
    return str(uuid.uuid4())


@pytest.fixture
def user_b():
    return str(uuid.uuid4())


@pytest.fixture
def ctx_a(tenant_a, user_a):
    return CurrentContext(
        tenant_id=tenant_a,
        user_id=user_a,
        role="tenant_admin",
    )


@pytest.fixture
def ctx_b(tenant_b, user_b):
    return CurrentContext(
        tenant_id=tenant_b,
        user_id=user_b,
        role="tenant_admin",
    )


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def override_auth(ctx_a):
    """Override get_current_context so protected routes use ctx_a. Restore after test."""
    async def _ctx():
        return ctx_a
    app.dependency_overrides[get_current_context] = _ctx
    yield
    app.dependency_overrides.pop(get_current_context, None)


@pytest.fixture
def override_auth_b(ctx_b):
    """Override get_current_context so protected routes use ctx_b."""
    async def _ctx():
        return ctx_b
    app.dependency_overrides[get_current_context] = _ctx
    yield
    app.dependency_overrides.pop(get_current_context, None)
