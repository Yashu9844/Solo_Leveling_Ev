// Loop 15.5: optional encryption of an export. Round trip; a wrong passphrase, a damaged file and a hostile envelope are refused cleanly and
// before anything touches the database.
import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { db } from '../../src/db/db';
import { getAllEvents } from '../../src/db/events';
import { verifyIntegrity } from '../../src/db/projections';
import { DEFAULT_CONFIG } from '../../src/engine/config';
import { exportBackup, importBackup } from '../../src/store/backup';
import { decryptExport, encryptExport, ENCRYPTED_FORMAT, isEncryptedExport, NotAnEncryptedExportError, PassphraseRequiredError, WrongPassphraseError, type EncryptedEnvelope } from '../../src/store/exportCrypto';
import { dateAt, legacyActivityLog } from './support/legacyActivityLog';
import { loadLegacyDb, prefixOf } from './support/legacyDb';

const log = legacyActivityLog({ seed: 5, days: 20 });
const PASS = 'correct horse battery staple';

describe('the envelope', () => {
  it('round-trips text of any kind, and says what it is and how it was made', async () => {
    const text = JSON.stringify({ name: 'Zoë ✓ 日本語', events: Array.from({ length: 2000 }, (_, i) => ({ i })) });
    const sealed = await encryptExport(text, PASS);
    const envelope = JSON.parse(sealed) as EncryptedEnvelope;
    expect(envelope).toMatchObject({ format: ENCRYPTED_FORMAT, kdf: 'PBKDF2-SHA256', cipher: 'AES-256-GCM', iterations: 600_000 });
    expect(isEncryptedExport(sealed)).toBe(true);
    expect(sealed).not.toContain('Zoë');
    expect(await decryptExport(sealed, PASS)).toBe(text);
  });

  it('is different every time: a fresh salt and IV per file', async () => {
    const [a, b] = await Promise.all([encryptExport('same', PASS), encryptExport('same', PASS)]);
    const [first, second] = [JSON.parse(a) as EncryptedEnvelope, JSON.parse(b) as EncryptedEnvelope];
    expect(first.salt).not.toBe(second.salt);
    expect(first.iv).not.toBe(second.iv);
    expect(first.data).not.toBe(second.data);
  });

  it('a wrong passphrase is refused, and so is a file with one byte changed - neither yields any text', async () => {
    const sealed = await encryptExport('the backup', PASS);
    await expect(decryptExport(sealed, 'not the passphrase')).rejects.toBeInstanceOf(WrongPassphraseError);
    const envelope = JSON.parse(sealed) as EncryptedEnvelope;
    const bytes = Buffer.from(envelope.data, 'base64');
    bytes[0] = bytes[0]! ^ 1;
    await expect(decryptExport(JSON.stringify({ ...envelope, data: bytes.toString('base64') }), PASS)).rejects.toBeInstanceOf(WrongPassphraseError);
  });

  it('a passphrase is the same passphrase however the characters were composed', async () => {
    const sealed = await encryptExport('x', 'café au lait');
    expect(await decryptExport(sealed, 'café au lait')).toBe('x');
  });

  it('refuses what is not ours or would be unsafe to run: other JSON, text, weak or absurd iteration counts, a missing passphrase', async () => {
    const sealed = JSON.parse(await encryptExport('x', PASS)) as EncryptedEnvelope;
    await expect(decryptExport('{"events":[]}', PASS)).rejects.toBeInstanceOf(NotAnEncryptedExportError);
    await expect(decryptExport('not json', PASS)).rejects.toBeInstanceOf(NotAnEncryptedExportError);
    await expect(decryptExport(JSON.stringify({ ...sealed, iterations: 10 }), PASS)).rejects.toBeInstanceOf(NotAnEncryptedExportError);
    await expect(decryptExport(JSON.stringify({ ...sealed, iterations: 1e12 }), PASS)).rejects.toBeInstanceOf(NotAnEncryptedExportError);
    await expect(decryptExport(JSON.stringify({ ...sealed, cipher: 'ROT13' }), PASS)).rejects.toBeInstanceOf(NotAnEncryptedExportError);
    await expect(decryptExport(JSON.stringify(sealed), '')).rejects.toBeInstanceOf(PassphraseRequiredError);
    await expect(encryptExport('x', '')).rejects.toThrow(/passphrase/);
    expect(isEncryptedExport('{"events":[]}')).toBe(false);
    expect(isEncryptedExport('garbage')).toBe(false);
  });
});

describe('a real backup', () => {
  it('encrypts the whole export, restores it with the passphrase, and the log still verifies', async () => {
    const deps = await loadLegacyDb(prefixOf(log, dateAt(15)), dateAt(15));
    const before = await getAllEvents();
    const file = await exportBackup(deps, PASS);
    expect(isEncryptedExport(file)).toBe(true);
    expect(file).not.toContain('ARC_STARTED');
    expect(file).not.toContain('legacy-arc');

    await Promise.all(db.tables.map((table) => table.clear()));
    await importBackup(file, PASS, DEFAULT_CONFIG, deps);
    expect((await getAllEvents()).map((event) => event.id)).toEqual(before.map((event) => event.id));
    expect(await verifyIntegrity(DEFAULT_CONFIG, deps)).toMatchObject({ clean: true });
  }, 60_000);

  it('a wrong or missing passphrase is refused before anything is written - the current data is untouched', async () => {
    const deps = await loadLegacyDb(prefixOf(log, dateAt(15)), dateAt(15));
    const file = await exportBackup(deps, PASS);
    const count = (await getAllEvents()).length;
    await expect(importBackup(file, 'wrong', DEFAULT_CONFIG, deps)).rejects.toBeInstanceOf(WrongPassphraseError);
    await expect(importBackup(file, undefined, DEFAULT_CONFIG, deps)).rejects.toBeInstanceOf(PassphraseRequiredError);
    expect((await getAllEvents()).length).toBe(count);
  }, 60_000);

  it('a plain backup is exactly what it was, needs no passphrase, and imports as before', async () => {
    const deps = await loadLegacyDb(prefixOf(log, dateAt(15)), dateAt(15));
    const plain = await exportBackup(deps);
    expect(isEncryptedExport(plain)).toBe(false);
    expect(JSON.parse(plain)).toHaveProperty('events');
    const count = (await getAllEvents()).length;
    await Promise.all(db.tables.map((table) => table.clear()));
    await importBackup(plain, undefined, DEFAULT_CONFIG, deps);
    expect((await getAllEvents()).length).toBe(count);
  }, 60_000);
});
