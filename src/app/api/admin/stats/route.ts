import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase/server';

export type DateRangeType =
  | 'today_vs_yesterday'
  | 'this_week_vs_last_week'
  | 'last_7_days'
  | 'last_30_days';

export type AdminStatsQuery = {
  platform?: 'all' | 'youtube' | 'chzzk';
  dateRange?: DateRangeType;
  channelIds?: string[];
  contentType?: 'all' | 'video' | 'short' | 'vod';
};

/**
 * KST 기준 날짜 범위 계산
 * 모든 계산은 한국 시간(UTC+9) 기준으로 수행
 */
function getDateRanges(range: DateRangeType) {
  // UTC 시간을 KST로 변환 (간단하고 명확한 방법)
  const nowUTC = new Date();
  const kstNow = new Date(nowUTC.getTime() + 9 * 60 * 60 * 1000);
  
  let current: { start: Date; end: Date };
  let previous: { start: Date; end: Date } | null = null;

  switch (range) {
    case 'today_vs_yesterday': {
      // 오늘 00:00 ~ 현재 시각
      const todayStart = new Date(kstNow);
      todayStart.setUTCHours(0, 0, 0, 0);
      
      // 어제 00:00 ~ 오늘 00:00
      const yesterdayStart = new Date(todayStart);
      yesterdayStart.setUTCDate(yesterdayStart.getUTCDate() - 1);
      
      current = { start: todayStart, end: kstNow };
      previous = { start: yesterdayStart, end: todayStart };
      break;
    }

    case 'this_week_vs_last_week': {
      // 이번 주 월요일 00:00 ~ 현재 (월요일 시작 기준)
      const thisWeekStart = new Date(kstNow);
      const dayOfWeek = thisWeekStart.getUTCDay();
      const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // 일요일(0)이면 6, 아니면 dayOfWeek - 1
      thisWeekStart.setUTCDate(thisWeekStart.getUTCDate() - daysFromMonday);
      thisWeekStart.setUTCHours(0, 0, 0, 0);
      
      // 지난주 월요일 00:00 ~ 이번주 월요일 00:00
      const lastWeekStart = new Date(thisWeekStart);
      lastWeekStart.setUTCDate(lastWeekStart.getUTCDate() - 7);
      
      current = { start: thisWeekStart, end: kstNow };
      previous = { start: lastWeekStart, end: thisWeekStart };
      break;
    }

    case 'last_7_days': {
      // 정확히 7일 전 ~ 현재
      const start = new Date(kstNow);
      start.setUTCDate(start.getUTCDate() - 7);
      
      // 14일 전 ~ 7일 전
      const prevStart = new Date(start);
      prevStart.setUTCDate(prevStart.getUTCDate() - 7);
      
      current = { start, end: kstNow };
      previous = { start: prevStart, end: start };
      break;
    }

    case 'last_30_days': {
      // 정확히 30일 전 ~ 현재
      const start = new Date(kstNow);
      start.setUTCDate(start.getUTCDate() - 30);
      
      // 60일 전 ~ 30일 전
      const prevStart = new Date(start);
      prevStart.setUTCDate(prevStart.getUTCDate() - 30);
      
      current = { start, end: kstNow };
      previous = { start: prevStart, end: start };
      break;
    }
  }

  // UTC로 변환 (DB에 저장된 값과 비교하기 위해)
  return {
    current: {
      start: new Date(current.start.getTime() - 9 * 60 * 60 * 1000),
      end: new Date(current.end.getTime() - 9 * 60 * 60 * 1000),
    },
    previous: previous ? {
      start: new Date(previous.start.getTime() - 9 * 60 * 60 * 1000),
      end: new Date(previous.end.getTime() - 9 * 60 * 60 * 1000),
    } : null,
  };
}

export async function GET(request: NextRequest) {
  
  try {
    const supabase = await createSupabaseServer();
    const url = new URL(request.url);
    
    // 쿼리 파라미터 파싱
    const platform = (url.searchParams.get('platform') || 'all') as 'all' | 'youtube' | 'chzzk';
    const dateRange = (url.searchParams.get('dateRange') || 'last_7_days') as DateRangeType;
    const contentType = (url.searchParams.get('contentType') || 'all') as 'all' | 'video' | 'short' | 'vod';
    const channelIds = url.searchParams.getAll('channelIds');
    
    const { current, previous } = getDateRanges(dateRange);
    // 1. 채널 목록 조회
    let channelsQuery = supabase
      .from('channels')
      .select('id, platform, title');
    
    if (platform !== 'all') {
      channelsQuery = channelsQuery.eq('platform', platform);
    }
    if (channelIds.length > 0) {
      channelsQuery = channelsQuery.in('id', channelIds);
    }
    
    const { data: channels, error: channelsError } = await channelsQuery;
    if (channelsError) throw channelsError;
    
    const allChannelIds = channels?.map((c) => c.id) || [];
    
    // 채널이 없으면 빈 응답 반환
    if (allChannelIds.length === 0) {
      return NextResponse.json({
        kpi: {
          totalViews: 0,
          totalVideos: 0,
          totalChannels: 0,
          avgViews: 0,
          viewsChange: 0,
          videosChange: 0,
          channelsChange: 0,
          avgViewsChange: 0,
        },
        platformStats: [],
        channelStats: [],
        contentTypeDistribution: [],
        dateRange: {
          current: { 
            start: current.start.toISOString(), 
            end: current.end.toISOString() 
          },
          previous: previous ? { 
            start: previous.start.toISOString(), 
            end: previous.end.toISOString() 
          } : null,
        },
        dailyViews: [],
      });
    }
const { data: sampleTypes, error: sampleErr } = await supabase
  .from('videos_cache')
  .select('content_type')
  .in('channel_id', allChannelIds)
  .limit(50);

    // 2. 현재 기간 영상 데이터 조회
    let currentVideosQuery = supabase
      .from('videos_cache')
      .select('id, channel_id, view_count, content_type, published_at')
      .in('channel_id', allChannelIds)
      .gte('published_at', current.start.toISOString())
      .lte('published_at', current.end.toISOString()); // lt → lte로 변경

    if (contentType !== 'all') {
      currentVideosQuery = currentVideosQuery.eq('content_type', contentType);
    }

    const { data: currentVideos, error: currentErr } = await currentVideosQuery;
    if (currentErr) throw currentErr;
    
    const videos = currentVideos ?? [];

    // 3. 이전 기간 영상 데이터 조회
    let previousVideos: any[] = [];
    if (previous) {
      let prevQuery = supabase
        .from('videos_cache')
        .select('id, channel_id, view_count, content_type, published_at')
        .in('channel_id', allChannelIds)
        .gte('published_at', previous.start.toISOString())
        .lt('published_at', previous.end.toISOString());

      if (contentType !== 'all') {
        prevQuery = prevQuery.eq('content_type', contentType);
      }

      const { data: prevData, error: prevErr } = await prevQuery;
      if (prevErr) throw prevErr;
      previousVideos = prevData ?? [];
    }

    // 4. 기수 정보 조회
    const generationMap: Record<string, number | undefined> = {};
    if (allChannelIds.length > 0) {
      const { data: creatorRows } = await supabase
        .from('creator_channels')
        .select('channel_id, creators(gen)')
        .in('channel_id', allChannelIds);
      
      creatorRows?.forEach((row) => {
        if (row.creators) {
          const creator = Array.isArray(row.creators) ? row.creators[0] : row.creators;
          generationMap[row.channel_id] = creator?.gen;
        }
      });
    }

    // 5. KPI 계산
    const totalViews = videos.reduce((sum, v) => sum + (v.view_count || 0), 0);
    const totalVideos = videos.length;
    const totalChannels = channels.length;
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

    // 6. 플랫폼별 통계
    const platformStats: Array<{ 
      platform: 'youtube' | 'chzzk'; 
      views: number; 
      videos: number; 
      avgViews: number;
    }> = [];
    
    channels.forEach((channel) => {
      const channelVideos = videos.filter((v) => v.channel_id === channel.id);
      const views = channelVideos.reduce((sum, v) => sum + (v.view_count || 0), 0);
      
      let entry = platformStats.find((p) => p.platform === channel.platform);
      if (!entry) {
        entry = { 
          platform: channel.platform as 'youtube' | 'chzzk', 
          views: 0, 
          videos: 0, 
          avgViews: 0 
        };
        platformStats.push(entry);
      }
      
      entry.views += views;
      entry.videos += channelVideos.length;
    });
    
    platformStats.forEach((p) => {
      p.avgViews = p.videos > 0 ? Math.round(p.views / p.videos) : 0;
    });

    // 7. 채널별 통계
    const channelStats = channels.map((channel) => {
      const channelVideos = videos.filter((v) => v.channel_id === channel.id);
      const views = channelVideos.reduce((sum, v) => sum + (v.view_count || 0), 0);
      
      const prevChannelVideos = previousVideos.filter((v) => v.channel_id === channel.id);
      const prevViews = prevChannelVideos.reduce((sum, v) => sum + (v.view_count || 0), 0);
      
      const viewsChangePercent = prevViews > 0 
        ? ((views - prevViews) / prevViews) * 100 
        : 0;
      
      return {
        channelId: channel.id,
        channelName: channel.title || 'Unknown',
        platform: channel.platform as 'youtube' | 'chzzk',
        generation: generationMap[channel.id],
        totalViews: views,
        totalVideos: channelVideos.length,
        avgViews: channelVideos.length > 0 ? Math.round(views / channelVideos.length) : 0,
        viewsChange: Math.round(viewsChangePercent * 10) / 10,
      };
    });

    // 8. 콘텐츠 타입 분포
    const contentTypeDistribution: Array<{ 
      type: 'video' | 'short' | 'vod'; 
      count: number; 
      percentage: number;
    }> = [];
    
    const allowedTypes = new Set(['video', 'short', 'vod']);
    videos.forEach((video) => {
      const type = video.content_type as 'video' | 'short' | 'vod';
      if (!allowedTypes.has(type)) return;
      
      let entry = contentTypeDistribution.find((c) => c.type === type);
      if (!entry) {
        entry = { type, count: 0, percentage: 0 };
        contentTypeDistribution.push(entry);
      }
      entry.count += 1;
    });
    
    const knownTypeTotal = contentTypeDistribution.reduce((sum, c) => sum + c.count, 0);
    contentTypeDistribution.forEach((c) => {
      c.percentage = knownTypeTotal > 0 
        ? Math.round((c.count / knownTypeTotal) * 1000) / 10 
        : 0;
    });

    // 9. 일별 조회수 데이터 (차트용)
    const { data: dailyViews, error: dailyViewsError } = await supabase.rpc('rpc_daily_views', {
      p_start: current.start.toISOString().slice(0, 10),
      p_end: current.end.toISOString().slice(0, 10),
      p_platform: platform === 'all' ? null : platform,
      p_channel_ids: allChannelIds.length ? allChannelIds : null,

      p_published_start: current.start.toISOString(),
      p_published_end: current.end.toISOString(),

      p_content_type: contentType === 'all' ? null : contentType,
    });
    if (dailyViewsError) {
      console.error('dailyViews RPC error:', dailyViewsError);
    }

    // 응답 반환 (24시간 캐시 + 1시간 stale-while-revalidate)
    return NextResponse.json(
      {
        kpi: {
          totalViews,
          totalVideos,
          totalChannels,
          avgViews,
          viewsChange: Math.round(viewsChange * 10) / 10,
          videosChange: Math.round(videosChange * 10) / 10,
          channelsChange: 0, // 현재 로직에서는 항상 0
          avgViewsChange: Math.round(avgViewsChange * 10) / 10,
        },
        platformStats,
        channelStats,
        contentTypeDistribution,
        dateRange: {
          current: {
            start: current.start.toISOString(),
            end: current.end.toISOString(),
          },
          previous: previous
            ? {
                start: previous.start.toISOString(),
                end: previous.end.toISOString(),
              }
            : null,
        },
        dailyViews: dailyViews || [],
      },
      {
        headers: {
          'Cache-Control': 'public, max-age=86400, stale-while-revalidate=3600',
        },
      }
    );
  } catch (error) {
    console.error('Admin stats error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch admin statistics' }, 
      { status: 500 }
    );
  }
}