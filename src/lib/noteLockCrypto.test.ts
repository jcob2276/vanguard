import { describe, expect, it } from 'vitest';
import { decryptNotePayload, encryptNotePayload } from './noteLockCrypto';

describe('note lock crypto', () => {
  it('round-trips encrypted note content', async () => {
    const payload = { title: 'Sekret', content: '<p>Prywatna treść</p>', tags: ['osobiste'] };
    const encrypted = await encryptNotePayload(payload, 'silne-haslo');

    expect(encrypted.locked_payload).not.toContain('Prywatna treść');
    await expect(decryptNotePayload(encrypted, 'silne-haslo')).resolves.toEqual(payload);
  });

  it('rejects an incorrect passphrase', async () => {
    const encrypted = await encryptNotePayload(
      { title: 'Sekret', content: 'Treść', tags: [] },
      'poprawne-haslo',
    );

    await expect(decryptNotePayload(encrypted, 'zle-haslo')).rejects.toThrow('Nieprawidłowe hasło');
  });
});
