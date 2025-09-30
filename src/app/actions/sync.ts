'use server';

export async function refreshChannelAction(channelId: string, mode: 'recent' | 'full' = 'recent') {
  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/sync/channel`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ channelId, mode }),
    cache: 'no-store',
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || 'Failed to sync');
  }
  return res.json();
}
