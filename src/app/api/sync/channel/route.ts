import { NextResponse } from 'next/server';
import { supabaseService } from '@/lib/supabase/service';
import { parseSyncBody } from '@/lib/validations/sync';
import { SYNC_COOLDOWN_MIN } from '@/lib/config/constants';
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
import { runChannelSync } from '@/services/sync/runChannelSync';

const CRON_SECRET = process.env.CRON_SECRET;
if (!CRON_SECRET) {
  throw new Error('CRON_SECRET is not configured');
}

function requireCronSecret(req: Request) {
  return req.headers.get('x-cron-secret') === CRON_SECRET;
}

export async function POST(request: Request) {
  if (!requireCronSecret(request)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  let body: { channelId: string; mode: 'recent' | 'full'; force?: boolean };
  try {
    body = parseSyncBody(await request.json());
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: 'Invalid body', details: e?.issues ?? String(e) }, { status: 400 });
  }

  const result = await runChannelSync(
    {
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
      config: {
        syncCooldownMinutes: SYNC_COOLDOWN_MIN,
      },
      logger: console,
    },
    body
  );

  if (!result.ok) {
    return NextResponse.json(result.body, { status: result.status });
  }

  return NextResponse.json({
    ok: true,
    queued: true,
    ...result.body,
  });
}
