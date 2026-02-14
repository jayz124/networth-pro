import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { resolveProvider } from '@/lib/services/ai-service';

// GET /api/v1/budget/ai/status — check if AI is available
export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { provider, apiKey, model } = await resolveProvider(userId);
    const isAvailable = Boolean(apiKey);

    return NextResponse.json({
      ai_available: isAvailable,
      message: isAvailable
        ? `AI powered by ${provider} (${model})`
        : 'No AI provider configured. Set an API key in Settings.',
      ai_provider_name: isAvailable ? provider : null,
    });
  } catch (e) {
    console.error('Failed to check AI status:', e);
    return NextResponse.json({
      ai_available: false,
      message: 'Failed to check AI status',
      ai_provider_name: null,
    });
  }
}
