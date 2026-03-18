"""Encrypt/decrypt credentials. Single key from env. Never log or return plaintext."""

import base64
import os
from typing import Optional

# Use Fernet (symmetric) or simple XOR for MVP. For production use cryptography.fernet.
def _get_key() -> bytes:
    raw = os.environ.get("ENCRYPTION_KEY", "")
    if not raw or len(raw) < 32:
        raise ValueError("ENCRYPTION_KEY must be set and at least 32 chars")
    return raw.encode("utf-8")[:32].ljust(32, b"\0")


def encrypt(plaintext: str) -> str:
    key = _get_key()
    data = plaintext.encode("utf-8")
    encrypted = bytes(a ^ b for a, b in zip(data, (key * (len(data) // len(key) + 1))[:len(data)]))
    return base64.b64encode(encrypted).decode("ascii")


def decrypt(ciphertext: str) -> str:
    key = _get_key()
    encrypted = base64.b64decode(ciphertext.encode("ascii"))
    decrypted = bytes(a ^ b for a, b in zip(encrypted, (key * (len(encrypted) // len(key) + 1))[:len(encrypted)]))
    return decrypted.decode("utf-8")
