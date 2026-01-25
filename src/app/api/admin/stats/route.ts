import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase/server';

type DateRangeType = 'today_vs_yesterday' | 'this_week_vs_last_week' | 'last_7_days' | 'last_30_days';

function getDateRanges(range: DateRangeType) {
  const now = new Date();
  const kstNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
  
  let current: { start: Date; end: Date };
  let previous: { start: Date; end: Date } | null = null;

  switch (range) {
    case 'today_vs_yesterday': {
      const today = new Date(kstNow);
      today.setHours(0, 0, 0, 0);
      
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      
      current = { start: today, end: kstNow };
      previous = { 
        start: yesterday, 
        end: new Date(yesterday.getTime() + (kstNow.getTime() - today.getTime())) 
      };
      break;
    }
    case 'this_week_vs_last_week': {
      const weekStart = new Date(kstNow);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      weekStart.setHours(0, 0, 0, 0);
      
      const lastWeekStart = new Date(weekStart);
      lastWeekStart.setDate(lastWeekStart.getDate() - 7);
      
      const lastWeekEnd = new Date(lastWeekStart);
      lastWeekEnd.setDate(lastWeekEnd.getDate() + 7);
      
      current = { start: weekStart, end: kstNow };
      previous = { start: lastWeekStart, end: lastWeekEnd };
      break;
    }
    case 'last_7_days': {
      const start = new Date(kstNow);
      start.setDate(start.getDate() - 7);
      start.setHours(0, 0, 0, 0);
      
      const prevStart = new Date(start);
      prevStart.setDate(prevStart.getDate() - 7);
      
      current = { start, end: kstNow };
      previous = { start: prevStart, end: start };
      break;
    }
    case 'last_30_days': {
      const start = new Date(kstNow);
      start.setDate(start.getDate() - 30);
      start.setHours(0, 0, 0, 0);
      
      const prevStart = new Date(start);
      prevStart.setDate(prevStart.getDate() - 30);
      
      current = { start, end: kstNow };
      previous = { start: prevStart, end: start };
      break;
    }
  }

  return { current, previous };
}

export async function GET(request: Request) {
  try {
    const supabase = await createSupabaseServer();
    const url = new URL(request.url);
    
    const platform = url.searchParams.get('platform') || 'all';
    const dateRange = (url.searchParams.get('dateRange') || 'last_7_days') as DateRangeType;
    const channelIds = url.searchParams.getAll('channelIds');

    const { current, previous } = getDateRanges(dateRange);

    // 1. 채널 목록 조회
    let channelsQuery = supabase.from('channels').select('id, platform, title');
    
    if (platform !== 'all') {
      channelsQuery = channelsQuery.eq('platform', platform);
    }
    if (channelIds.length > 0) {
      channelsQuery = channelsQuery.in('id', channelIds);
    }

    const { data: channels, error: channelsError } = await channelsQuery;
    if (channelsError) throw channelsError;

    const allChannelIds = channels?.map(c => c.id) || [];

    // 2. 현재 기간 영상 데이터
    const { data: currentVideos, error: currentError } = await supabase
      .from('videos_cache')
      .select('id, channel_id, view_count, content_type, published_at')
      .in('channel_id', allChannelIds)
      .gte('published_at', current.start.toISOString())
      .lte('published_at', current.end.toISOString());
    
    if (currentError) throw currentError;

    // 3. 이전 기간 영상 데이터 (비교용)
    let previousVideos: any[] = [];
    if (previous) {
      const { data, error } = await supabase
        .from('videos_cache')
        .select('id, channel_id, view_count, content_type')
        .in('channel_id', allChannelIds)
        .gte('published_at', previous.start.toISOString())
        .lte('published_at', previous.end.toISOString());
      
      if (!error) previousVideos = data || [];
    }

    // 4. KPI 계산
    const totalViews = currentVideos?.reduce((sum, v) => sum + (v.view_count || 0), 0) || 0;
    const totalVideos = currentVideos?.length || 0;
    const totalChannels = channels?.length || 0;
    const avgViews = totalVideos > 0 ? Math.round(totalViews / totalVideos) : 0;

    const prevTotalViews = previousVideos.reduce((sum, v) => sum + (v.view_count || 0), 0);
    const prevTotalVideos = previousVideos.length;
    const prevAvgViews = prevTotalVideos > 0 ? Math.round(prevTotalViews / prevTotalVideos) : 0;

    const viewsChange = prevTotalViews > 0 
      ? ((totalViews - prevTotalViews) / prevTotalViews) * 100 
      : 0;
    const videosChange = prevTotalVideos > 0 
      ? ((totalVideos - prevTotalVideos) / prevTotalVideos) * 100 
      : 0;
    const avgViewsChange = prevAvgViews > 0 
      ? ((avgViews - prevAvgViews) / prevAvgViews) * 100 
      : 0;

    // 5. 플랫폼별 통계
    const platformStats = channels?.reduce((acc, channel) => {
      const channelVideos = currentVideos?.filter(v => v.channel_id === channel.id) || [];
      const views = channelVideos.reduce((sum, v) => sum + (v.view_count || 0), 0);
      
      const existing = acc.find(p => p.platform === channel.platform);
      if (existing) {
        existing.views += views;
        existing.videos += channelVideos.length;
      } else {
        acc.push({
          platform: channel.platform as 'youtube' | 'chzzk',
          views,
          videos: channelVideos.length,
          avgViews: 0,
        });
      }
      return acc;
    }, [] as Array<{ platform: 'youtube' | 'chzzk'; views: number; videos: number; avgViews: number }>);

    platformStats?.forEach(p => {
      p.avgViews = p.videos > 0 ? Math.round(p.views / p.videos) : 0;
    });

    // 6. 채널별 통계
    const channelStats = await Promise.all(
      (channels || []).map(async (channel) => {
        const channelVideos = currentVideos?.filter(v => v.channel_id === channel.id) || [];
        const views = channelVideos.reduce((sum, v) => sum + (v.view_count || 0), 0);
        
        const prevChannelVideos = previousVideos.filter(v => v.channel_id === channel.id);
        const prevViews = prevChannelVideos.reduce((sum, v) => sum + (v.view_count || 0), 0);
        
        const viewsChange = prevViews > 0 ? ((views - prevViews) / prevViews) * 100 : 0;

        // 크리에이터 정보 조회 (기수)
        const { data: creatorData } = await supabase
          .from('creator_channels')
          .select('creator_id, creators(gen)')
          .eq('channel_id', channel.id)
          .single();

        return {
          channelId: channel.id,
          channelName: channel.title || 'Unknown',
          platform: channel.platform as 'youtube' | 'chzzk',
          generation: (creatorData?.creators as any)?.gen || undefined,
          totalViews: views,
          totalVideos: channelVideos.length,
          avgViews: channelVideos.length > 0 ? Math.round(views / channelVideos.length) : 0,
          viewsChange: Math.round(viewsChange * 10) / 10,
        };
      })
    );

    // 7. 콘텐츠 타입별 분포
    const contentTypeDistribution = currentVideos?.reduce((acc, video) => {
      const type = video.content_type as 'video' | 'short' | 'vod';
      const existing = acc.find(c => c.type === type);
      if (existing) {
        existing.count += 1;
      } else {
        acc.push({ type, count: 1, percentage: 0 });
      }
      return acc;
    }, [] as Array<{ type: 'video' | 'short' | 'vod'; count: number; percentage: number }>);

    contentTypeDistribution?.forEach(c => {
      c.percentage = totalVideos > 0 ? Math.round((c.count / totalVideos) * 100 * 10) / 10 : 0;
    });

    return NextResponse.json({
      kpi: {
        totalViews,
        totalVideos,
        totalChannels,
        avgViews,
        viewsChange: Math.round(viewsChange * 10) / 10,
        videosChange: Math.round(videosChange * 10) / 10,
        channelsChange: 0,
        avgViewsChange: Math.round(avgViewsChange * 10) / 10,
      },
      platformStats: platformStats || [],
      channelStats: channelStats || [],
      contentTypeDistribution: contentTypeDistribution || [],
      dateRange: {
        current: {
          start: current.start.toISOString(),
          end: current.end.toISOString(),
        },
        previous: previous ? {
          start: previous.start.toISOString(),
          end: previous.end.toISOString(),
        } : null,
      },
    });
  } catch (error) {
    console.error('Admin stats error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch admin statistics' },
      { status: 500 }
    );
  }
}