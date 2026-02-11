import { NextResponse } from 'next/server';
import { resolveProvider } from '@/lib/services/ai-service';

// GET /api/v1/budget/ai/status — check if AI is available
export async function GET() {
  try {
    const { provider, apiKey, model } = await resolveProvider();

    return NextResponse.json({
      available: Boolean(apiKey),
      provider: apiKey ? provider : null,
      model: apiKey ? model : null,
    });
  } catch (e) {
    console.error('Failed to check AI status:', e);
    return NextResponse.json({
      available: false,
      provider: null,
      model: null,
    });
  }
}
