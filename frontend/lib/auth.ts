import { auth, currentUser } from '@clerk/nextjs/server';

export async function getAuthUser() {
  const { userId } = await auth();
  if (!userId) return null;

  const user = await currentUser();
  return {
    userId,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    isPro: (user?.publicMetadata as any)?.isPro === true,
    displayName: user?.firstName || user?.username || 'User',
  };
}

export async function requireAuth() {
  const { userId } = await auth();
  if (!userId) {
    throw new Error('Unauthorized');
  }
  return userId;
}
