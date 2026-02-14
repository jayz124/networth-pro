import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { encrypt, isEncrypted } from '@/lib/services/encryption';

const SECRET_KEYS = new Set([
  'groq_api_key',
  'openai_api_key',
  'claude_api_key',
  'kimi_api_key',
  'gemini_api_key',
  'rentcast_api_key',
]);

// POST /api/v1/settings/encrypt-existing — encrypt any plaintext secret values
export async function POST() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const settings = await prisma.appSettings.findMany({ where: { user_id: userId } });
    let encrypted = 0;

    for (const setting of settings) {
      if (!SECRET_KEYS.has(setting.key) && !setting.is_secret) continue;
      if (!setting.value) continue;
      if (isEncrypted(setting.value)) continue;

      // Plaintext secret found — encrypt it
      const encryptedValue = encrypt(setting.value);
      await prisma.appSettings.update({
        where: { user_id_key: { user_id: userId, key: setting.key } },
        data: { value: encryptedValue, is_secret: true },
      });
      encrypted++;
    }

    return NextResponse.json({
      status: 'done',
      encrypted_count: encrypted,
    });
  } catch (e) {
    console.error('Failed to encrypt existing secrets:', e);
    return NextResponse.json({ error: 'Failed to encrypt existing secrets' }, { status: 500 });
  }
}
