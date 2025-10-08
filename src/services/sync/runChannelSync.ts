import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  YouTubePlaylistPage,
  YouTubeVideoMeta,
  YoutubeChannelMeta,
} from '@/lib/youtube/client';

export type ChannelSyncInput = {
  channelId: string;
  mode: 'recent' | 'full';
  force?: boolean;
};

export type ChannelSyncStats = {
  fetched: number;
  upserted: number;
};

type ChannelRecord = {
  id: string;
  platform: string;
  platform_channel_id: string;
  sync_cooldown_until: string | null;
  last_synced_at: string | null;
  last_live_ended_at: string | null;
  title: string | null;
  thumbnail_url: string | null;
};

type ChzzkLiveStatus = {
  openLive: boolean;
  liveDetail?: {
    liveId: number;
    liveTitle: string;
    liveImageUrl: string | null;
    concurrentUserCount: number | null;
    categoryType: string | null;
    chatChannelId: string | null;
    openDate: string;
    closeDate: string | null;
  };
} | null;

type ChzzkChannelMeta = {
  channelId: string;
  channelName: string;
  channelImageUrl: string | null;
};

type ChzzkVideoRow = {
  channel_id: string;
  platform_video_id: string;
  title: string;
  thumbnail_url: string | null;
  published_at: string;
  duration_sec: number | null;
  view_count: number | null;
  like_count: number | null;
  content_type: 'video' | 'short' | 'live' | 'vod';
  is_live: boolean;
  chzzk_video_no: number | null;
};

type ChannelSyncConfig = {
  syncCooldownMinutes: number;
  cutoffDays: number;
  youtubeRecentPages: number;
  youtubeFullPagesMax: number;
  chzzkVodRecentPages: number;
  chzzkVodFullPagesMax: number;
  chzzkUpsertBatchSize: number;
};

const DEFAULT_CONFIG: ChannelSyncConfig = {
  syncCooldownMinutes: 5,
  cutoffDays: 120,
  youtubeRecentPages: 1,
  youtubeFullPagesMax: 5,
  chzzkVodRecentPages: 1,
  chzzkVodFullPagesMax: 5,
  chzzkUpsertBatchSize: 500,
};

export type ChannelSyncDeps = {
  supabase: SupabaseClient<any, any, any>;
  youtube: {
    getUploadsPlaylistId: (platformChannelId: string) => Promise<string | null>;
    listPlaylistItems: (playlistId: string, pageToken?: string | null) => Promise<YouTubePlaylistPage>;
    batchGetVideos: (videoIds: string[]) => Promise<YouTubeVideoMeta[]>;
    getChannelMeta: (platformChannelId: string) => Promise<YoutubeChannelMeta | null>;
  };
  chzzk: {
    getChannelMeta: (channelId: string) => Promise<ChzzkChannelMeta | null>;
    getLiveStatus: (channelId: string) => Promise<ChzzkLiveStatus>;
    getVideosPage: (
      channelId: string,
      limit?: number,
      offset?: number
    ) => Promise<{ items: any[]; page: number; totalPages: number }>;
    mapVideoToCacheRow: (channelUuid: string, video: any) => ChzzkVideoRow;
  };
  config?: Partial<ChannelSyncConfig>;
  logger?: Pick<Console, 'error' | 'warn' | 'info'>;
  time?: {
    now?: () => Date;
    kstNow?: () => Date;
  };
};

type ChannelSyncSuccess = {
  ok: true;
  status: number;
  body: {
    channelId: string;
    platform: string;
    mode: 'recent' | 'full';
    stats: ChannelSyncStats;
    startedAt: string;
    finishedAt: string;
    durationMs: number;
    cooldownUntil: string | null;
  };
};

type ChannelSyncFailure = {
  ok: false;
  status: number;
  body: Record<string, unknown>;
};

export type ChannelSyncResult = ChannelSyncSuccess | ChannelSyncFailure;

export async function runChannelSync(
  deps: ChannelSyncDeps,
  input: ChannelSyncInput
): Promise<ChannelSyncResult> {
  const cfg = { ...DEFAULT_CONFIG, ...deps.config } satisfies ChannelSyncConfig;
  const nowFn = deps.time?.now ?? (() => new Date());
  const kstNowFn = deps.time?.kstNow ?? createKstNow;

  const operationStartedAt = nowFn();

  const { data: channelRecord, error: channelSelectError } = await deps.supabase
    .from('channels')
    .select(
      'id, platform, platform_channel_id, sync_cooldown_until, last_synced_at, last_live_ended_at, title, thumbnail_url'
    )
    .eq('id', input.channelId)
    .single<ChannelRecord>();

  if (channelSelectError) {
    return failure(500, {
      ok: false,
      error: 'DB',
      message: 'DB error',
      details: channelSelectError.message,
    });
  }

  if (!channelRecord) {
    return failure(404, {
      ok: false,
      error: 'NOT_FOUND',
      message: 'Channel not found',
    });
  }

  if (!input.force && input.mode === 'recent' && channelRecord.sync_cooldown_until) {
    const cooldownUntilDate = new Date(channelRecord.sync_cooldown_until);
    if (cooldownUntilDate > nowFn()) {
      return failure(429, {
        ok: false,
        error: 'COOLDOWN',
        message: 'Cooldown',
        cooldownUntil: cooldownUntilDate.toISOString(),
      });
    }
  }

  const stats: ChannelSyncStats = { fetched: 0, upserted: 0 };
  const cutoffDate = getKstCutoff(kstNowFn, cfg.cutoffDays);

  try {
    if (channelRecord.platform === 'youtube') {
      const result = await syncYoutubeChannel({ deps, channelRecord, mode: input.mode, cutoffDate, cfg });
      stats.fetched = result.fetched;
      stats.upserted = result.upserted;
    } else if (channelRecord.platform === 'chzzk') {
      const result = await syncChzzkChannel({ deps, channelRecord, mode: input.mode, cutoffDate, cfg });
      stats.fetched = result.fetched;
      stats.upserted = result.upserted;
    } else {
      return failure(400, {
        ok: false,
        error: 'UNSUPPORTED_PLATFORM',
        message: 'Unsupported platform',
        details: channelRecord.platform,
      });
    }
  } catch (error) {
    deps.logger?.error?.('[channel-sync] sync failed', error);
    return failure(502, {
      ok: false,
      error: 'SYNC_FAILED',
      message: 'Sync failed',
      details: String((error as Error)?.message ?? error),
    });
  }

  const finishedAt = nowFn();
  const durationMs = finishedAt.getTime() - operationStartedAt.getTime();

  const cooldownUntilISO =
    input.mode === 'recent'
      ? new Date(finishedAt.getTime() + cfg.syncCooldownMinutes * 60_000).toISOString()
      : null;

  const { error: channelUpdateError } = await deps.supabase
    .from('channels')
    .update({
      last_synced_at: finishedAt.toISOString(),
      ...(cooldownUntilISO ? { sync_cooldown_until: cooldownUntilISO } : {}),
    })
    .eq('id', channelRecord.id);

  if (channelUpdateError) {
    return failure(500, {
      ok: false,
      error: 'DB',
      message: 'DB error',
      details: channelUpdateError.message,
    });
  }

  return success(200, {
    channelId: channelRecord.id,
    platform: channelRecord.platform,
    mode: input.mode,
    stats,
    startedAt: operationStartedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs,
    cooldownUntil: cooldownUntilISO,
  });
}

function success(status: number, body: ChannelSyncSuccess['body']): ChannelSyncSuccess {
  return { ok: true, status, body };
}

function failure(status: number, body: Record<string, unknown>): ChannelSyncFailure {
  return { ok: false, status, body };
}

function createKstNow(): Date {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
}

function getKstCutoff(kstNowFn: () => Date, cutoffDays: number): Date {
  const d = kstNowFn();
  const copy = new Date(d.getTime());
  copy.setDate(copy.getDate() - cutoffDays);
  return copy;
}

type SyncYoutubeParams = {
  deps: ChannelSyncDeps;
  channelRecord: ChannelRecord;
  mode: 'recent' | 'full';
  cutoffDate: Date;
  cfg: ChannelSyncConfig;
};

type SyncResult = ChannelSyncStats;

async function syncYoutubeChannel({ deps, channelRecord, mode, cutoffDate, cfg }: SyncYoutubeParams): Promise<SyncResult> {
  const stats: ChannelSyncStats = { fetched: 0, upserted: 0 };

  try {
    const meta = await deps.youtube.getChannelMeta(channelRecord.platform_channel_id);
    if (meta) {
      const updates: Record<string, unknown> = {};
      if (meta.title && meta.title !== channelRecord.title) {
        updates.title = meta.title;
      }
      if (meta.thumbnailUrl && meta.thumbnailUrl !== channelRecord.thumbnail_url) {
        updates.thumbnail_url = meta.thumbnailUrl;
      }
      if (Object.keys(updates).length) {
        const result = await deps.supabase.from('channels').update(updates).eq('id', channelRecord.id);
        if (result.error) throw result.error;
      }
    }
  } catch (error) {
    deps.logger?.warn?.('[youtube] channel meta refresh skipped', error);
  }

  const uploadsPlaylistId = await deps.youtube.getUploadsPlaylistId(channelRecord.platform_channel_id);
  if (!uploadsPlaylistId) {
    return stats;
  }

  const maxPages = mode === 'recent' ? cfg.youtubeRecentPages : cfg.youtubeFullPagesMax;

  let nextPageToken: string | null | undefined = null;
  const collectedRows: Array<{
    platform_video_id: string;
    title: string;
    thumbnail_url: string | null;
    published_at: string;
    duration_sec: number | null;
    view_count: number | null;
    like_count: number | null;
    content_type: 'video' | 'short' | 'live' | 'vod';
    is_live: boolean;
  }> = [];

  for (let pageIndex = 0; pageIndex < maxPages; pageIndex++) {
    const { ids: videoIds, nextPageToken: nextToken } = await deps.youtube.listPlaylistItems(uploadsPlaylistId, nextPageToken);
    if (!videoIds?.length) break;

    const videoMetas = await deps.youtube.batchGetVideos(videoIds);
    const filteredMetas = videoMetas.filter((meta) => new Date(meta.publishedAt) >= cutoffDate);

    for (const meta of filteredMetas) {
      collectedRows.push({
        platform_video_id: meta.id,
        title: meta.title,
        thumbnail_url: meta.thumbnailUrl ?? null,
        published_at: meta.publishedAt,
        duration_sec: meta.durationSec ?? null,
        view_count: meta.viewCount ?? null,
        like_count: meta.likeCount ?? null,
        content_type: meta.contentType,
        is_live: !!meta.isLive,
      });
    }

    if (mode === 'full' && filteredMetas.length === 0) {
      break;
    }

    if (!nextToken) {
      break;
    }
    nextPageToken = nextToken;
  }

  const rowsForUpsert = collectedRows
    .filter((row) => new Date(row.published_at) >= cutoffDate)
    .map((row) => ({ ...row, channel_id: channelRecord.id }));

  stats.fetched = rowsForUpsert.length;

  if (!rowsForUpsert.length) {
    return stats;
  }

  const upsertResult = await deps.supabase
    .from('videos_cache')
    .upsert(rowsForUpsert, { onConflict: 'platform_video_id' })
    .select('id');

  if (upsertResult.error) {
    throw upsertResult.error;
  }

  stats.upserted = upsertResult.data?.length ?? 0;
  return stats;
}

type SyncChzzkParams = {
  deps: ChannelSyncDeps;
  channelRecord: ChannelRecord;
  mode: 'recent' | 'full';
  cutoffDate: Date;
  cfg: ChannelSyncConfig;
};

async function syncChzzkChannel({ deps, channelRecord, mode, cutoffDate, cfg }: SyncChzzkParams): Promise<SyncResult> {
  const stats: ChannelSyncStats = { fetched: 0, upserted: 0 };

  const liveStatus = await deps.chzzk.getLiveStatus(channelRecord.platform_channel_id);
  const isLiveNow = !!liveStatus?.openLive;

  const channelMeta = await deps.chzzk.getChannelMeta(channelRecord.platform_channel_id).catch(() => null);
  if (channelMeta) {
    const updates: Record<string, unknown> = {};
    if (channelMeta.channelName && channelMeta.channelName !== channelRecord.title) {
      updates.title = channelMeta.channelName;
    }
    if (channelMeta.channelImageUrl && channelMeta.channelImageUrl !== channelRecord.thumbnail_url) {
      updates.thumbnail_url = channelMeta.channelImageUrl;
    }
    if (Object.keys(updates).length) {
      const updateResult = await deps.supabase.from('channels').update(updates).eq('id', channelRecord.id);
      if (updateResult.error) throw updateResult.error;
    }
  }

  const payload = {
    liveId: liveStatus?.liveDetail?.liveId != null ? String(liveStatus.liveDetail.liveId) : null,
    title: liveStatus?.liveDetail?.liveTitle ?? null,
    thumbnail: liveStatus?.liveDetail?.liveImageUrl ?? null,
    concurrentUserCount: liveStatus?.liveDetail?.concurrentUserCount ?? null,
    category: liveStatus?.liveDetail?.categoryType ?? null,
    chatChannelId: liveStatus?.liveDetail?.chatChannelId ?? null,
    openDate: liveStatus?.liveDetail?.openDate ?? null,
    closeDate: liveStatus?.liveDetail?.closeDate ?? null,
  };

  const { error: liveStateRpcError } = await deps.supabase.rpc('rpc_update_channel_live_state', {
    p_channel_id: channelRecord.id,
    p_is_live_now: isLiveNow,
    p_live_data: payload,
  });

  if (liveStateRpcError) {
    throw liveStateRpcError;
  }

  const shouldFetchVod = true;
  if (!shouldFetchVod) {
    return stats;
  }

  const pagesToFetch = mode === 'recent' ? cfg.chzzkVodRecentPages : cfg.chzzkVodFullPagesMax;
  const requestLimit = 20;

  let offset = 0;
  const seenPlatformIds = new Set<string>();
  const collectedRows: ChzzkVideoRow[] = [];
  let reachedCutoff = false;
  const cutoffMs = cutoffDate.getTime();

  for (let page = 0; page < pagesToFetch && !reachedCutoff; page++) {
    const { items } = await deps.chzzk.getVideosPage(channelRecord.platform_channel_id, requestLimit, offset);
    if (!items.length) break;

    for (const item of items) {
      const publishedTimestampMs = getChzzkPublishedMs(item);
      if (publishedTimestampMs < cutoffMs) {
        reachedCutoff = true;
        break;
      }

      const platformVideoId = typeof item.videoId === 'string' ? `chzzk:${item.videoId}` : undefined;
      if (!platformVideoId || seenPlatformIds.has(platformVideoId)) {
        continue;
      }
      seenPlatformIds.add(platformVideoId);

      collectedRows.push(deps.chzzk.mapVideoToCacheRow(channelRecord.id, item));
    }

    offset += items.length;
  }

  if (!collectedRows.length) {
    return stats;
  }

  const withinCutoff = collectedRows.filter((row) => new Date(row.published_at) >= cutoffDate);
  if (!withinCutoff.length) {
    return stats;
  }

  const deduplicated = new Map<string, ChzzkVideoRow>();
  for (const row of withinCutoff) {
    deduplicated.set(row.platform_video_id, row);
  }

  const uniqueRows = Array.from(deduplicated.values());
  stats.fetched = uniqueRows.length;

  for (let i = 0; i < uniqueRows.length; i += cfg.chzzkUpsertBatchSize) {
    const batchSlice = uniqueRows.slice(i, i + cfg.chzzkUpsertBatchSize);
    const upsertResult = await deps.supabase
      .from('videos_cache')
      .upsert(batchSlice, { onConflict: 'platform_video_id' })
      .select('id');

    if (upsertResult.error) {
      throw upsertResult.error;
    }
    stats.upserted += upsertResult.data?.length ?? 0;
  }

  return stats;
}

function getChzzkPublishedMs(item: any): number {
  if (typeof item.publishDateAt === 'number') {
    return item.publishDateAt;
  }
  if (typeof item.publishDate === 'string') {
    return Date.parse(item.publishDate.replace(' ', 'T') + '+09:00');
  }
  return Date.now();
}
