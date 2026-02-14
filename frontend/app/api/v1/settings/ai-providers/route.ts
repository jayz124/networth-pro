import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getAIProviders } from '@/lib/services/ai-service';

// GET /api/v1/settings/ai-providers — get AI provider info
export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const providers = await getAIProviders(userId);
    return NextResponse.json(providers);
  } catch (e) {
    console.error('Failed to get AI providers:', e);
    return NextResponse.json({ error: 'Failed to get AI providers' }, { status: 500 });
  }
}
