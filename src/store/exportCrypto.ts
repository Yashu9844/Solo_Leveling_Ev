// Optional encryption of an export file (platform/04 Q16: required before a public listing; platform/05 loop 15.5).
//
// AES-256-GCM with a key derived from the person's passphrase by PBKDF2-SHA-256 (600,000 iterations, the OWASP figure for this primitive), a
// fresh random salt and IV per file. GCM authenticates: a wrong passphrase and a damaged file both fail the tag check, and neither yields
// plaintext. Nothing here is a secret store: the passphrase lives only in the person's head, and a lost passphrase is a lost backup - the
// screens say so. The file is a JSON envelope that names its own parameters, so a later build can raise the iteration count and still read
// today's files. Web Crypto only: no dependency, no network.

export const ENCRYPTED_FORMAT = 'system-export-encrypted/1';
export const PBKDF2_ITERATIONS = 600_000;
const MIN_ITERATIONS = 100_000;
const MAX_ITERATIONS = 10_000_000;

export interface EncryptedEnvelope {
  format: typeof ENCRYPTED_FORMAT;
  kdf: 'PBKDF2-SHA256';
  iterations: number;
  cipher: 'AES-256-GCM';
  /** base64 */
  salt: string;
  iv: string;
  data: string;
}

/** The passphrase did not open the file, or the file was damaged: GCM cannot tell the two apart, and says nothing more. */
export class WrongPassphraseError extends Error {
  constructor() {
    super('That passphrase does not open this backup, or the file is damaged.');
    this.name = 'WrongPassphraseError';
  }
}

/** The file is encrypted and no passphrase was given. */
export class PassphraseRequiredError extends Error {
  constructor() {
    super('This backup is encrypted. Enter its passphrase.');
    this.name = 'PassphraseRequiredError';
  }
}

export class NotAnEncryptedExportError extends Error {
  constructor() {
    super('That is not an encrypted backup.');
    this.name = 'NotAnEncryptedExportError';
  }
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

function fromBase64(text: string): Uint8Array<ArrayBuffer> {
  const binary = atob(text);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function keyFor(passphrase: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(passphrase.normalize('NFKC')), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

/** Whether `text` is one of our encrypted envelopes (cheap: it does not try to decrypt). */
export function isEncryptedExport(text: string): boolean {
  try {
    const parsed = JSON.parse(text) as Partial<EncryptedEnvelope>;
    return parsed.format === ENCRYPTED_FORMAT;
  } catch {
    return false;
  }
}

export async function encryptExport(plaintext: string, passphrase: string, iterations = PBKDF2_ITERATIONS): Promise<string> {
  if (passphrase.length === 0) throw new Error('A passphrase is required to encrypt a backup.');
  const salt = crypto.getRandomValues(new Uint8Array(new ArrayBuffer(16)));
  const iv = crypto.getRandomValues(new Uint8Array(new ArrayBuffer(12)));
  const key = await keyFor(passphrase, salt, iterations);
  const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(plaintext)));
  const envelope: EncryptedEnvelope = { format: ENCRYPTED_FORMAT, kdf: 'PBKDF2-SHA256', iterations, cipher: 'AES-256-GCM', salt: toBase64(salt), iv: toBase64(iv), data: toBase64(encrypted) };
  return JSON.stringify(envelope, null, 2);
}

export async function decryptExport(text: string, passphrase: string): Promise<string> {
  let envelope: Partial<EncryptedEnvelope>;
  try {
    envelope = JSON.parse(text) as Partial<EncryptedEnvelope>;
  } catch {
    throw new NotAnEncryptedExportError();
  }
  if (envelope.format !== ENCRYPTED_FORMAT || envelope.kdf !== 'PBKDF2-SHA256' || envelope.cipher !== 'AES-256-GCM') throw new NotAnEncryptedExportError();
  const { iterations, salt, iv, data } = envelope;
  // A hostile or damaged file must not be able to make the device grind for minutes, or to run a weakened derivation.
  if (typeof iterations !== 'number' || iterations < MIN_ITERATIONS || iterations > MAX_ITERATIONS || typeof salt !== 'string' || typeof iv !== 'string' || typeof data !== 'string') throw new NotAnEncryptedExportError();
  if (passphrase.length === 0) throw new PassphraseRequiredError();
  try {
    const key = await keyFor(passphrase, fromBase64(salt), iterations);
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromBase64(iv) }, key, fromBase64(data));
    return new TextDecoder().decode(plain);
  } catch {
    throw new WrongPassphraseError();
  }
}
