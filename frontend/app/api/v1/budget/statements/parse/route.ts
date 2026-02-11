import { NextRequest, NextResponse } from 'next/server';
import { parseStatement } from '@/lib/services/statement-parser';

// POST /api/v1/budget/statements/parse — parse an uploaded bank statement file
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ detail: 'No file provided' }, { status: 400 });
    }

    // Read file content
    const arrayBuffer = await file.arrayBuffer();
    const content = Buffer.from(arrayBuffer);

    if (content.length === 0) {
      return NextResponse.json({ detail: 'File is empty' }, { status: 400 });
    }

    // Max 10MB
    if (content.length > 10 * 1024 * 1024) {
      return NextResponse.json({ detail: 'File too large. Maximum size is 10MB.' }, { status: 400 });
    }

    const result = parseStatement(file.name, content);

    return NextResponse.json({
      transactions: result.transactions,
      errors: result.errors,
      warnings: result.warnings,
      bank_detected: result.bank_detected || null,
      account_info: result.account_info || null,
      parser_used: result.parser_used,
      headers_detected: result.headers_detected || null,
      sample_lines: result.sample_lines || null,
      transaction_count: result.transactions.length,
    });
  } catch (e) {
    console.error('Failed to parse statement:', e);
    return NextResponse.json({ error: 'Failed to parse statement' }, { status: 500 });
  }
}
