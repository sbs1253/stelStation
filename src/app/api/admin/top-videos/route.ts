import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase/server';

export async function GET(request: Request) {
  try {
    const supabase = await createSupabaseServer();
    const url = new URL(request.url);
    
    const platform = url.searchParams.get('platform') || 'all';
    const contentType = url.searchParams.get('contentType') || 'all';
    const limit = parseInt(url.searchParams.get('limit') || '10', 10);
    const channelIds = url.searchParams.getAll('channelIds');

    // 최근 120일 기준
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 120);

    let query = supabase
      .from('videos_cache')
      .select(`
        id,
        platform_video_id,
        title,
        thumbnail_url,
        view_count,
        published_at,
        content_type,
        channel_id,
        channels (
          id,
          title,
          platform
        )
      `)
      .gte('published_at', cutoffDate.toISOString())
      .order('view_count', { ascending: false })
      .limit(limit);

    if (channelIds.length > 0) {
      query = query.in('channel_id', channelIds);
    }

    if (contentType !== 'all') {
      query = query.eq('content_type', contentType);
    }

    const { data: videos, error } = await query;
    if (error) throw error;

    const topVideos = videos?.map(video => ({
      videoId: video.platform_video_id,
      title: video.title,
      channelName: (video.channels as any)?.title || 'Unknown',
      platform: (video.channels as any)?.platform || 'youtube',
      contentType: video.content_type,
      views: video.view_count || 0,
      publishedAt: video.published_at,
      thumbnailUrl: video.thumbnail_url,
    })) || [];

    // 플랫폼 필터 적용 (채널 정보 기반)
    const filtered = platform === 'all' 
      ? topVideos 
      : topVideos.filter(v => v.platform === platform);

    return NextResponse.json({ topVideos: filtered });
  } catch (error) {
    console.error('Top videos error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch top videos' },
      { status: 500 }
    );
  }
}