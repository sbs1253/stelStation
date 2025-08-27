export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase/server';
import { mapChannelRowToItem } from '@/lib/channels/transform';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const channelId = (await params)?.id;
  if (!channelId) {
    return NextResponse.json({ error: 'Missing channel id' }, { status: 400 });
  }
  if (!/^[0-9a-fA-F-]{36}$/.test(channelId)) {
    return NextResponse.json({ error: 'Invalid channel id' }, { status: 400 });
  }
  const supabase = await createSupabaseServer();

  const { data, error } = await supabase.rpc('rpc_channels_page', {
    limit_count: 1,
    p_channel_id: channelId,
  });

  if (error) {
    return NextResponse.json({ error: 'DB error', details: error.message }, { status: 500 });
  }

  const row = (data ?? [])[0];
  if (row) return NextResponse.json(mapChannelRowToItem(row));

  //  채널은 있으나 120일 요약이 0건인 경우
  const { data: channel, error: channelErr } = await supabase
    .from('channels')
    .select('id, title, thumbnail_url')
    .eq('id', channelId)
    .single();

  if (channelErr || !channel) {
    return NextResponse.json({ error: 'Channel not found' }, { status: 404 });
  }

  return NextResponse.json({
    id: channel.id,
    title: channel.title ?? '',
    thumbnailUrl: channel.thumbnail_url ?? null,
    recentPublishedAt: null,
    videoCount120d: 0,
  });
}
