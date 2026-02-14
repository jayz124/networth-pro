import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
const KNOWN_SETTINGS: Record<string, { is_secret: boolean; default_value: string | null }> = {
  groq_api_key: { is_secret: true, default_value: null },
  openai_api_key: { is_secret: true, default_value: null },
  claude_api_key: { is_secret: true, default_value: null },
  kimi_api_key: { is_secret: true, default_value: null },
  gemini_api_key: { is_secret: true, default_value: null },
  rentcast_api_key: { is_secret: true, default_value: null },
  ai_provider: { is_secret: false, default_value: 'groq' },
  ai_model: { is_secret: false, default_value: null },
  default_currency: { is_secret: false, default_value: 'USD' },
};

const SECRET_MASK = '\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022';

// GET /api/v1/settings — list all settings
export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const dbSettings = await prisma.appSettings.findMany({
      where: { user_id: userId },
    });
    const dbMap = new Map(dbSettings.map((s) => [s.key, s]));

    const result: Array<{
      key: string;
      value: string | null;
      is_secret: boolean;
      is_set: boolean;
    }> = [];

    for (const [key, meta] of Object.entries(KNOWN_SETTINGS)) {
      const dbSetting = dbMap.get(key);
      const rawValue = dbSetting?.value ?? null;
      const hasValue = rawValue !== null && rawValue !== '';

      result.push({
        key,
        value: meta.is_secret ? (hasValue ? SECRET_MASK : null) : (rawValue ?? meta.default_value),
        is_secret: meta.is_secret,
        is_set: hasValue,
      });
    }

    // Include any settings not in KNOWN_SETTINGS
    for (const setting of dbSettings) {
      if (!KNOWN_SETTINGS[setting.key]) {
        result.push({
          key: setting.key,
          value: setting.is_secret ? (setting.value ? SECRET_MASK : null) : setting.value,
          is_secret: setting.is_secret,
          is_set: Boolean(setting.value),
        });
      }
    }

    return NextResponse.json(result);
  } catch (e) {
    console.error('Failed to list settings:', e);
    return NextResponse.json({ error: 'Failed to list settings' }, { status: 500 });
  }
}
