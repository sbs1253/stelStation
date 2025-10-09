import { supabaseService } from '@/lib/supabase/service';
import {
  getUploadsPlaylistId,
  listPlaylistItems,
  batchGetVideos,
  getYoutubeChannelMeta,
} from '@/lib/youtube/client';
import {
  getChzzkChannelMeta,
  getChzzkLiveStatus,
  getChzzkVideosPage,
  mapChzzkVideoToCacheRow,
} from '@/lib/chzzk/client';
import type { ChannelSyncDeps } from '@/services/sync/runChannelSync';

export function createSyncDeps(): ChannelSyncDeps {
  return {
    supabase: supabaseService,
    youtube: {
      getUploadsPlaylistId,
      listPlaylistItems,
      batchGetVideos,
      getChannelMeta: getYoutubeChannelMeta,
    },
    chzzk: {
      getChannelMeta: getChzzkChannelMeta,
      getLiveStatus: getChzzkLiveStatus,
      getVideosPage: getChzzkVideosPage,
      mapVideoToCacheRow: mapChzzkVideoToCacheRow,
    },
    logger: console,
  };
}
