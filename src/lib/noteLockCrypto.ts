export interface LockableNotePayload {
  title: string;
  content: string;
  tags: string[];
}

export interface EncryptedNotePayload {
  locked_payload: string;
  lock_salt: string;
  lock_iv: string;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const bytesToBase64 = (bytes: Uint8Array) => {
  let binary = '';
  bytes.forEach(byte => { binary += String.fromCharCode(byte); });
  return btoa(binary);
};

const base64ToBytes = (value: string) => {
  const binary = atob(value);
  return Uint8Array.from(binary, character => character.charCodeAt(0));
};

async function deriveKey(passphrase: string, salt: Uint8Array) {
  const source = await crypto.subtle.importKey(
    'raw',
    encoder.encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt.buffer as ArrayBuffer, iterations: 210_000, hash: 'SHA-256' },
    source,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function encryptNotePayload(
  payload: LockableNotePayload,
  passphrase: string,
): Promise<EncryptedNotePayload> {
  if (passphrase.length < 6) throw new Error('Hasło musi mieć co najmniej 6 znaków.');
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt);
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv.buffer as ArrayBuffer },
    key,
    encoder.encode(JSON.stringify(payload)),
  );
  return {
    locked_payload: bytesToBase64(new Uint8Array(encrypted)),
    lock_salt: bytesToBase64(salt),
    lock_iv: bytesToBase64(iv),
  };
}

export async function decryptNotePayload(
  encrypted: EncryptedNotePayload,
  passphrase: string,
): Promise<LockableNotePayload> {
  try {
    const salt = base64ToBytes(encrypted.lock_salt);
    const iv = base64ToBytes(encrypted.lock_iv);
    const key = await deriveKey(passphrase, salt);
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv.buffer as ArrayBuffer },
      key,
      base64ToBytes(encrypted.locked_payload).buffer as ArrayBuffer,
    );
    return JSON.parse(decoder.decode(decrypted)) as LockableNotePayload;
  } catch {
    throw new Error('Nieprawidłowe hasło lub uszkodzona notatka.');
  }
}
