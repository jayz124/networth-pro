/**
 * Encryption service for API keys and other secrets at rest.
 *
 * Uses AES-256-GCM (via Node.js crypto). The encryption key is stored
 * in a file outside the database directory, auto-generated on first use.
 *
 * Encrypted values are prefixed with "enc::" so we can distinguish them
 * from legacy plaintext values (important for migration).
 */
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const ENCRYPTED_PREFIX = 'enc::';
const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 12; // 96 bits for GCM
const AUTH_TAG_LENGTH = 16;

// Key file lives alongside the database
const SECRETS_DIR = path.join(process.cwd(), '.secrets');
const KEY_FILE = path.join(SECRETS_DIR, 'encryption.key');

let cachedKey: Buffer | null = null;

function ensureKeyDir(): void {
    if (!fs.existsSync(SECRETS_DIR)) {
        fs.mkdirSync(SECRETS_DIR, { recursive: true, mode: 0o700 });
    }
    // Write .gitignore to prevent accidental commit
    const gitignore = path.join(SECRETS_DIR, '.gitignore');
    if (!fs.existsSync(gitignore)) {
        fs.writeFileSync(gitignore, '*\n');
    }
}

function loadOrCreateKey(): Buffer {
    if (cachedKey) return cachedKey;

    ensureKeyDir();

    if (fs.existsSync(KEY_FILE)) {
        const raw = fs.readFileSync(KEY_FILE);
        if (raw.length >= KEY_LENGTH) {
            cachedKey = raw.subarray(0, KEY_LENGTH);
            return cachedKey;
        }
    }

    // Generate new key
    const key = crypto.randomBytes(KEY_LENGTH);
    fs.writeFileSync(KEY_FILE, key, { mode: 0o600 });
    cachedKey = key;
    return key;
}

export function encrypt(plaintext: string): string {
    if (!plaintext) return plaintext;

    const key = loadOrCreateKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
        authTagLength: AUTH_TAG_LENGTH,
    });

    const encrypted = Buffer.concat([
        cipher.update(plaintext, 'utf8'),
        cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    // Format: enc::<iv>:<authTag>:<ciphertext> (all base64)
    return (
        ENCRYPTED_PREFIX +
        iv.toString('base64') +
        ':' +
        authTag.toString('base64') +
        ':' +
        encrypted.toString('base64')
    );
}

export function decrypt(value: string): string {
    if (!value) return value;

    // Pass through unencrypted (legacy plaintext) values
    if (!value.startsWith(ENCRYPTED_PREFIX)) {
        return value;
    }

    const key = loadOrCreateKey();
    const payload = value.slice(ENCRYPTED_PREFIX.length);
    const parts = payload.split(':');

    if (parts.length !== 3) {
        console.error('Invalid encrypted value format');
        return '';
    }

    const [ivB64, tagB64, ciphertextB64] = parts;

    try {
        const iv = Buffer.from(ivB64, 'base64');
        const authTag = Buffer.from(tagB64, 'base64');
        const ciphertext = Buffer.from(ciphertextB64, 'base64');

        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
            authTagLength: AUTH_TAG_LENGTH,
        });
        decipher.setAuthTag(authTag);

        const decrypted = Buffer.concat([
            decipher.update(ciphertext),
            decipher.final(),
        ]);

        return decrypted.toString('utf8');
    } catch (e) {
        console.error('Failed to decrypt value — key may have changed', e);
        return '';
    }
}

export function isEncrypted(value: string | null | undefined): boolean {
    return Boolean(value && value.startsWith(ENCRYPTED_PREFIX));
}
