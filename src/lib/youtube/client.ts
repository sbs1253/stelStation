// src/lib/youtube/client.ts
type YTPlaylistPage = {
  ids: string[];
  nextPageToken?: string | null;
};

export type YTVideoMeta = {
  id: string;
  title: string;
  thumbnailUrl: string | null;
  publishedAt: string; // ISO
  durationSec: number | null;
  viewCount: number | null;
  likeCount: number | null; // YouTube는 비공개인 경우 많음
  isLive: boolean;
  contentType: 'video' | 'short' | 'live' | 'vod';
};

const YT_KEY = process.env.YOUTUBE_API_KEY;

// 공통 fetch (키 없으면 mock)
async function ytFetch<T>(url: string): Promise<T> {
  if (!YT_KEY) {
    // mock: 빈 결과
    // @ts-expect-error
    return {};
  }
  console.log(url);
  const sep = url.includes('?') ? '&' : '?';
  const full = `${url}${sep}key=${encodeURIComponent(YT_KEY)}`;
  const res = await fetch(full);
  if (!res.ok) throw new Error(`YouTube API ${res.status}`);
  return res.json() as Promise<T>;
}

function parseISODurationToSeconds(iso?: string | null): number | null {
  if (!iso) return null;
  // 간단 파서(PnDTnHnMnS)
  const m = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/i.exec(iso);
  if (!m) return null;
  const h = parseInt(m[1] || '0', 10);
  const min = parseInt(m[2] || '0', 10);
  const s = parseInt(m[3] || '0', 10);
  return h * 3600 + min * 60 + s;
}

/** 채널 → 업로드 재생목록 ID */
export async function getUploadsPlaylistId(channelId: string): Promise<string | null> {
  if (!YT_KEY) return null;
  type Resp = {
    items?: Array<{ contentDetails?: { relatedPlaylists?: { uploads?: string } } }>;
  };
  const data = await ytFetch<Resp>(
    `https://www.googleapis.com/youtube/v3/channels?part=contentDetails&id=${encodeURIComponent(channelId)}`
  );
  return data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads ?? null;
}

/** 업로드 재생목록 → Video ID 묶음 (1페이지) */
export async function listPlaylistItems(playlistId: string, pageToken?: string | null): Promise<YTPlaylistPage> {
  if (!YT_KEY) return { ids: [], nextPageToken: null };
  type Resp = {
    nextPageToken?: string;
    items?: Array<{ contentDetails?: { videoId?: string } }>;
  };
  const url =
    `https://www.googleapis.com/youtube/v3/playlistItems?part=contentDetails&maxResults=50&playlistId=${encodeURIComponent(
      playlistId
    )}` + (pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : '');
  const data = await ytFetch<Resp>(url);
  const ids = (data.items || []).map((it) => it.contentDetails?.videoId).filter((v): v is string => !!v);
  return { ids, nextPageToken: data.nextPageToken ?? null };
}

/** Video IDs → 상세 메타(최대 50개/호출) */
export async function batchGetVideos(videoIds: string[]): Promise<YTVideoMeta[]> {
  if (!YT_KEY || videoIds.length === 0) return [];

  type Resp = {
    items?: Array<{
      id: string;
      snippet?: {
        title?: string;
        publishedAt?: string;
        thumbnails?: { default?: { url?: string }; medium?: { url?: string }; high?: { url?: string } };
      };
      contentDetails?: { duration?: string };
      statistics?: { viewCount?: string; likeCount?: string };
      liveStreamingDetails?: { actualStartTime?: string; actualEndTime?: string };
    }>;
  };

  const chunks: string[][] = [];
  for (let i = 0; i < videoIds.length; i += 50) {
    chunks.push(videoIds.slice(i, i + 50));
  }

  const out: YTVideoMeta[] = [];

  for (const chunk of chunks) {
    const url =
      `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,statistics,liveStreamingDetails` +
      `&id=${encodeURIComponent(chunk.join(','))}`;

    const data = await ytFetch<Resp>(url);

    for (const v of data.items || []) {
      const dur = parseISODurationToSeconds(v.contentDetails?.duration || null);
      const publishedAt = v.snippet?.publishedAt || new Date().toISOString();
      const thumb =
        v.snippet?.thumbnails?.high?.url ||
        v.snippet?.thumbnails?.medium?.url ||
        v.snippet?.thumbnails?.default?.url ||
        null;

      const isLiveNow = !!(v.liveStreamingDetails?.actualStartTime && !v.liveStreamingDetails?.actualEndTime);
      const isVodFromLive = !!v.liveStreamingDetails?.actualEndTime;
      const contentType: YTVideoMeta['contentType'] = isLiveNow
        ? 'live'
        : isVodFromLive
        ? 'vod'
        : (dur ?? 0) < 60
        ? 'short'
        : 'video';

      out.push({
        id: v.id,
        title: v.snippet?.title ?? '',
        thumbnailUrl: thumb,
        publishedAt,
        durationSec: dur,
        viewCount: v.statistics?.viewCount ? Number(v.statistics.viewCount) : null,
        likeCount: v.statistics?.likeCount ? Number(v.statistics.likeCount) : null,
        isLive: isLiveNow,
        contentType,
      });
    }
  }

  return out;
}
