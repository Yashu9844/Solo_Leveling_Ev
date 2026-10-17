// Backup and restore with optional encryption (platform/05 loop 15.5). The plain export and import stay exactly as they were
// (store/checkpoint.ts); these wrap them so a passphrase, when given, protects the file and nothing else about the flow changes.
import type { EngineConfig, EngineDeps } from '../engine/types';
import { exportSnapshotJson, importSnapshotJson } from './checkpoint';
import { decryptExport, encryptExport, isEncryptedExport, PassphraseRequiredError } from './exportCrypto';

/** The export, encrypted when a passphrase is given. The caller names the file `.enc.json` in that case. */
export async function exportBackup(deps: Pick<EngineDeps, 'now'>, passphrase?: string): Promise<string> {
  const json = await exportSnapshotJson(deps);
  return passphrase ? encryptExport(json, passphrase) : json;
}

/**
 * Imports a backup, decrypting it first if it is encrypted. A wrong or missing passphrase is refused before anything is read into the
 * database: the replace-everything import never starts on text it could not open.
 */
export async function importBackup(text: string, passphrase: string | undefined, config: EngineConfig, deps: EngineDeps): Promise<void> {
  if (!isEncryptedExport(text)) {
    await importSnapshotJson(text, config, deps);
    return;
  }
  if (!passphrase) throw new PassphraseRequiredError();
  await importSnapshotJson(await decryptExport(text, passphrase), config, deps);
}
