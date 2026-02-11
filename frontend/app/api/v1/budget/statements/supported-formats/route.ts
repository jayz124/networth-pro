import { NextResponse } from 'next/server';
import { resolveProvider, PROVIDER_CONFIG } from '@/lib/services/ai-service';

// GET /api/v1/budget/statements/supported-formats
export async function GET() {
  try {
    const { provider, apiKey } = await resolveProvider();
    const hasAI = Boolean(apiKey);
    const hasVision = hasAI && PROVIDER_CONFIG[provider]?.supports_vision;

    const formats = [
      {
        extension: '.csv',
        mime_type: 'text/csv',
        name: 'CSV (Comma-Separated Values)',
        description: 'Standard bank export format. Auto-detects columns and date formats.',
        requires_ai: false,
        supported: true,
      },
      {
        extension: '.ofx',
        mime_type: 'application/x-ofx',
        name: 'OFX/QFX (Open Financial Exchange)',
        description: 'Standard financial data format used by banks and financial software.',
        requires_ai: false,
        supported: true,
      },
      {
        extension: '.qfx',
        mime_type: 'application/x-qfx',
        name: 'QFX (Quicken Financial Exchange)',
        description: 'Quicken-compatible variant of OFX format.',
        requires_ai: false,
        supported: true,
      },
      {
        extension: '.pdf',
        mime_type: 'application/pdf',
        name: 'PDF Bank Statement',
        description: hasVision
          ? 'PDF parsing via text extraction with AI vision fallback for scanned documents.'
          : 'PDF text extraction supported. Enable AI with vision support for scanned documents.',
        requires_ai: false,
        supported: true,
      },
      {
        extension: '.png/.jpg',
        mime_type: 'image/*',
        name: 'Statement Images',
        description: hasVision
          ? 'AI vision will extract transactions from statement photos.'
          : 'Requires an AI provider with vision support (OpenAI, Claude, or Gemini).',
        requires_ai: true,
        supported: hasVision,
      },
    ];

    return NextResponse.json({
      formats,
      ai_available: hasAI,
      vision_available: hasVision,
      active_provider: hasAI ? provider : null,
    });
  } catch (e) {
    console.error('Failed to get supported formats:', e);
    return NextResponse.json({ error: 'Failed to get supported formats' }, { status: 500 });
  }
}
