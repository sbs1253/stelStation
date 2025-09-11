import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase/server';
import { mapChannelRowToItem } from '@/lib/channels/transform';
import { makeChannelUrl } from '@/lib/links';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const channelId = (await params)?.id;
  if (!channelId) return NextResponse.json({ error: 'Missing channel id' }, { status: 400 });
  if (!/^[0-9a-fA-F-]{36}$/.test(channelId)) {
    return NextResponse.json({ error: 'Invalid channel id' }, { status: 400 });
  }

  const supabase = await createSupabaseServer();

  // 1) RPC 경로 (있으면 이게 제일 풍부)
  const { data, error } = await supabase.rpc('rpc_channels_page', {
    limit_count: 1,
    p_channel_id: channelId,
  });
  if (error) return NextResponse.json({ error: 'DB error', details: error.message }, { status: 500 });

  const row = (data ?? [])[0];
  if (row) {
    return NextResponse.json(mapChannelRowToItem(row));
  }

  // 2) fallback: 채널 존재하지만 120일 요약이 0건
  const { data: ch, error: chErr } = await supabase
    .from('channels')
    .select('id, platform, platform_channel_id, title, thumbnail_url, is_live_now, last_live_ended_at')
    .eq('id', channelId)
    .single();

  if (chErr || !ch) return NextResponse.json({ error: 'Channel not found' }, { status: 404 });

  return NextResponse.json({
    id: ch.id,
    platform: ch.platform,
    platformChannelId: ch.platform_channel_id,
    title: ch.title ?? '',
    thumb: ch.thumbnail_url ?? null,
    isLiveNow: !!ch.is_live_now,
    recentPublishedAt: null,
    videoCount120d: 0,
    lastLiveEndedAt: ch.last_live_ended_at ?? null,
    url: makeChannelUrl(ch.platform, ch.platform_channel_id),
  });
}
