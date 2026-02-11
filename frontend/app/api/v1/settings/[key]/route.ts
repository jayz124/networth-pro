import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { settingUpdateSchema } from '@/lib/validators/shared';
import { encrypt } from '@/lib/services/encryption';

const SECRET_KEYS = new Set([
  'groq_api_key',
  'openai_api_key',
  'claude_api_key',
  'kimi_api_key',
  'gemini_api_key',
  'rentcast_api_key',
]);

const SECRET_MASK = '\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022';

// GET /api/v1/settings/[key]
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ key: string }> },
) {
  const { key } = await params;

  try {
    const setting = await prisma.appSettings.findUnique({ where: { key } });
    if (!setting) {
      return NextResponse.json({ detail: `Setting '${key}' not found` }, { status: 404 });
    }

    const isSecret = SECRET_KEYS.has(key) || setting.is_secret;

    return NextResponse.json({
      key: setting.key,
      value: isSecret ? (setting.value ? SECRET_MASK : null) : setting.value,
      is_secret: isSecret,
      is_set: Boolean(setting.value),
    });
  } catch (e) {
    console.error(`Failed to get setting '${key}':`, e);
    return NextResponse.json({ error: `Failed to get setting '${key}'` }, { status: 500 });
  }
}

// PUT /api/v1/settings/[key]
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> },
) {
  const { key } = await params;

  try {
    const body = await request.json();
    const parsed = settingUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { detail: parsed.error.issues.map((e: { message: string }) => e.message).join(', ') },
        { status: 422 },
      );
    }

    let value = parsed.data.value ?? null;
    const isSecret = SECRET_KEYS.has(key);

    // If user sends the mask back, don't update the value (they didn't change it)
    if (isSecret && value === SECRET_MASK) {
      const existing = await prisma.appSettings.findUnique({ where: { key } });
      if (existing) {
        return NextResponse.json({
          key: existing.key,
          value: SECRET_MASK,
          is_secret: true,
          is_set: Boolean(existing.value),
        });
      }
    }

    // Encrypt secret values
    if (isSecret && value) {
      value = encrypt(value);
    }

    const setting = await prisma.appSettings.upsert({
      where: { key },
      create: { key, value, is_secret: isSecret },
      update: { value, is_secret: isSecret },
    });

    return NextResponse.json({
      key: setting.key,
      value: isSecret ? (setting.value ? SECRET_MASK : null) : setting.value,
      is_secret: isSecret,
      is_set: Boolean(setting.value),
    });
  } catch (e) {
    console.error(`Failed to update setting '${key}':`, e);
    return NextResponse.json({ error: `Failed to update setting '${key}'` }, { status: 500 });
  }
}

// DELETE /api/v1/settings/[key]
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ key: string }> },
) {
  const { key } = await params;

  try {
    const existing = await prisma.appSettings.findUnique({ where: { key } });
    if (!existing) {
      return NextResponse.json({ detail: `Setting '${key}' not found` }, { status: 404 });
    }

    await prisma.appSettings.delete({ where: { key } });
    return NextResponse.json({ status: 'deleted' });
  } catch (e) {
    console.error(`Failed to delete setting '${key}':`, e);
    return NextResponse.json({ error: `Failed to delete setting '${key}'` }, { status: 500 });
  }
}
