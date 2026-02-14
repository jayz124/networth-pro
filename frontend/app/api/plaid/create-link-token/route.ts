import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

// POST /api/plaid/create-link-token — stub (Plaid not yet configured)
export async function POST() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.json(
    { error: 'Plaid integration not yet configured' },
    { status: 501 },
  );
}
