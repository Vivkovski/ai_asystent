"""Ask flow: POST messages calls run_ask with correct args and returns expected shape."""

from unittest.mock import AsyncMock, patch

import pytest


def test_ask_returns_message_and_sources(client, override_auth, tenant_a, user_a):
    """POST /conversations/:id/messages runs run_ask and returns message + sources."""
    with patch("api.v1.messages.chat_domain.get_conversation", return_value={"id": "conv-1"}):
        result = {
            "message": {
                "id": "msg-1",
                "role": "assistant",
                "content": "Odpowiedź.",
                "answer": "Odpowiedź.",
                "sources": [{"id": 1, "type": "documents", "title": "Drive", "link": "https://drive.google.com", "unavailable": False}],
                "status": "completed",
                "created_at": "2025-01-01T00:00:00Z",
            },
            "warning": None,
        }
        with patch("api.v1.messages.run_ask", new_callable=AsyncMock, return_value=result) as run_ask:
            r = client.post(
                "/api/v1/conversations/conv-1/messages",
                json={"content": "Gdzie są umowy?"},
            )
            assert r.status_code == 200
            data = r.json()
            assert "message" in data
            assert data["message"]["role"] == "assistant"
            assert "sources" in data["message"]
            run_ask.assert_called_once()
            call_args = run_ask.call_args[0]
            assert call_args[0] == tenant_a
            assert call_args[1] == user_a
            assert call_args[2] == "conv-1"
            assert call_args[3] == "Gdzie są umowy?"


def test_ask_rejects_empty_content(client, override_auth):
    """POST without content or empty content returns 400 or 422."""
    r = client.post("/api/v1/conversations/conv-1/messages", json={})
    assert r.status_code in (400, 422)
    r2 = client.post("/api/v1/conversations/conv-1/messages", json={"content": "   "})
    assert r2.status_code in (400, 422)


def test_ask_404_when_conversation_not_found(client, override_auth):
    """When get_conversation returns None, respond 404."""
    with patch("api.v1.messages.chat_domain.get_conversation", return_value=None):
        r = client.post(
            "/api/v1/conversations/unknown-id/messages",
            json={"content": "Pytanie"},
        )
        assert r.status_code == 404
