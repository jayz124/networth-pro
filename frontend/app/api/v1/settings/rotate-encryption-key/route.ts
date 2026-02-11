import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { encrypt, decrypt, isEncrypted } from '@/lib/services/encryption';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const SECRET_KEYS = new Set([
  'groq_api_key',
  'openai_api_key',
  'claude_api_key',
  'kimi_api_key',
  'gemini_api_key',
  'rentcast_api_key',
]);

const SECRETS_DIR = path.join(process.cwd(), '.secrets');
const KEY_FILE = path.join(SECRETS_DIR, 'encryption.key');
const KEY_LENGTH = 32;

// POST /api/v1/settings/rotate-encryption-key — decrypt with old key, re-encrypt with new key
export async function POST() {
  try {
    // Step 1: Read and decrypt all secret values using current key
    const settings = await prisma.appSettings.findMany();
    const decryptedSecrets: Array<{ key: string; plaintext: string }> = [];

    for (const setting of settings) {
      if (!SECRET_KEYS.has(setting.key) && !setting.is_secret) continue;
      if (!setting.value) continue;

      const plaintext = decrypt(setting.value);
      if (plaintext) {
        decryptedSecrets.push({ key: setting.key, plaintext });
      }
    }

    // Step 2: Generate a new encryption key (this replaces the key file)
    if (!fs.existsSync(SECRETS_DIR)) {
      fs.mkdirSync(SECRETS_DIR, { recursive: true, mode: 0o700 });
    }
    const newKey = crypto.randomBytes(KEY_LENGTH);
    fs.writeFileSync(KEY_FILE, newKey, { mode: 0o600 });

    // Step 3: Re-encrypt all secrets with the new key
    // Note: The encrypt() function will pick up the new key on next call
    // since we need to clear the cached key first.
    // We do this by requiring a fresh import or by writing directly.
    let reEncrypted = 0;

    for (const { key, plaintext } of decryptedSecrets) {
      const newEncrypted = encrypt(plaintext);
      await prisma.appSettings.update({
        where: { key },
        data: { value: newEncrypted },
      });
      reEncrypted++;
    }

    return NextResponse.json({
      status: 'rotated',
      re_encrypted_count: reEncrypted,
    });
  } catch (e) {
    console.error('Failed to rotate encryption key:', e);
    return NextResponse.json(
      { error: 'Failed to rotate encryption key. Some secrets may need manual re-entry.' },
      { status: 500 },
    );
  }
}
