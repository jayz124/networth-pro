import { NextResponse } from 'next/server';
import { getAIProviders } from '@/lib/services/ai-service';

// GET /api/v1/settings/ai-providers — get AI provider info
export async function GET() {
  try {
    const providers = await getAIProviders();
    return NextResponse.json(providers);
  } catch (e) {
    console.error('Failed to get AI providers:', e);
    return NextResponse.json({ error: 'Failed to get AI providers' }, { status: 500 });
  }
}
