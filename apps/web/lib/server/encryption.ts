/**
 * Encrypt/decrypt credentials. Same algorithm as Python backend (XOR + base64) for DB compatibility.
 * Never log or return plaintext. Server-only.
 */

function getKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY ?? "";
  if (!raw || raw.length < 32) {
    throw new Error("ENCRYPTION_KEY must be set and at least 32 chars");
  }
  const buf = Buffer.from(raw, "utf8");
  const key = Buffer.alloc(32, 0);
  buf.copy(key, 0, 0, 32);
  return key;
}

export function encrypt(plaintext: string): string {
  const key = getKey();
  const data = Buffer.from(plaintext, "utf8");
  const out = Buffer.alloc(data.length);
  for (let i = 0; i < data.length; i++) {
    out[i] = data[i]! ^ key[i % 32]!;
  }
  return out.toString("base64");
}

export function decrypt(ciphertext: string): string {
  const key = getKey();
  const encrypted = Buffer.from(ciphertext, "base64");
  const out = Buffer.alloc(encrypted.length);
  for (let i = 0; i < encrypted.length; i++) {
    out[i] = encrypted[i]! ^ key[i % 32]!;
  }
  return out.toString("utf8");
}
