import { NextResponse } from 'next/server';
import { getChzzkLiveStatus } from '@/lib/chzzk/client';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const channelId = url.searchParams.get('channelId');
  if (!channelId) return NextResponse.json({ error: 'channelId required' }, { status: 400 });

  const data = await getChzzkLiveStatus(channelId);
  return NextResponse.json(data ?? { openLive: false, liveDetail: null });
}
