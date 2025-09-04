// src/lib/youtube/client.ts

export type YouTubePlaylistPage = {
  ids: string[];
  nextPageToken?: string | null;
};

export type YouTubeVideoMeta = {
  id: string;
  title: string;
  thumbnailUrl: string | null;
  publishedAt: string; // ISO
  durationSec: number | null;
  viewCount: number | null;
  likeCount: number | null; // YouTube는 종종 비공개
  isLive: boolean;
  contentType: 'video' | 'short' | 'live' | 'vod';
};

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY ?? '';
const YOUTUBE_DEBUG = process.env.YOUTUBE_DEBUG === '1';

const MAX_VIDEO_IDS_PER_REQUEST = 50; // videos.list 한 번에 50개
const MAX_RETRY_ATTEMPTS = 3; // 429/5xx/레이트리밋 재시도 횟수
const BASE_BACKOFF_MS = 200; // 재시도 기본 대기 시간
const INTER_REQUEST_DELAY_MS = 120; // 연속 호출 사이 짧은 지연

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function parseIso8601DurationToSeconds(iso?: string | null): number | null {
  if (!iso) return null;
  // 포맷 예) PT1H2M3S
  const m = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/i.exec(iso);
  if (!m) return null;
  const hours = parseInt(m[1] || '0', 10);
  const minutes = parseInt(m[2] || '0', 10);
  const seconds = parseInt(m[3] || '0', 10);
  return hours * 3600 + minutes * 60 + seconds;
}

/** 공통 fetch + 재시도 + reason 로깅 */
async function youtubeFetchJson<T>(url: string, attempt = 1): Promise<T> {
  if (!YOUTUBE_API_KEY) {
    // 키가 없으면 mock처럼 빈 결과 반환
    // @ts-expect-error
    return {};
  }

  if (YOUTUBE_DEBUG) console.log(url);

  const sep = url.includes('?') ? '&' : '?';
  const full = `${url}${sep}key=${encodeURIComponent(YOUTUBE_API_KEY)}`;
  const res = await fetch(full);

  if (!res.ok) {
    // 에러 바디에서 reason 추출
    let bodyText = '';
    let reason = '';
    try {
      bodyText = await res.text();
      const j = JSON.parse(bodyText);
      reason = j?.error?.errors?.[0]?.reason || j?.error?.message || '';
    } catch {
      /* noop */
    }

    const isRateLimit =
      res.status === 429 || res.status >= 500 || /rateLimitExceeded|userRateLimitExceeded|quotaExceeded/i.test(reason);

    const canRetry = attempt < MAX_RETRY_ATTEMPTS && isRateLimit;

    if (canRetry) {
      const jitter = Math.floor(Math.random() * 200); // 0~199
      const backoff = BASE_BACKOFF_MS * attempt + jitter;
      await sleep(backoff);
      return youtubeFetchJson<T>(url, attempt + 1);
    }

    const detail = reason ? ` (${reason})` : '';
    throw new Error(`YouTube API ${res.status}${detail} ${bodyText.slice(0, 200)}`);
  }

  return res.json() as Promise<T>;
}

/** 채널 UCID → 업로드 재생목록 ID */
export async function getUploadsPlaylistId(channelId: string): Promise<string | null> {
  if (!YOUTUBE_API_KEY) return null;

  type ChannelsResponse = {
    items?: Array<{ contentDetails?: { relatedPlaylists?: { uploads?: string } } }>;
  };

  const data = await youtubeFetchJson<ChannelsResponse>(
    `https://www.googleapis.com/youtube/v3/channels?part=contentDetails&id=${encodeURIComponent(channelId)}`
  );

  return data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads ?? null;
}

/** 업로드 재생목록 → videoId 배열 (1페이지) */
export async function listPlaylistItems(playlistId: string, pageToken?: string | null): Promise<YouTubePlaylistPage> {
  if (!YOUTUBE_API_KEY) return { ids: [], nextPageToken: null };

  type PlaylistItemsResponse = {
    nextPageToken?: string;
    items?: Array<{ contentDetails?: { videoId?: string } }>;
  };

  const url =
    `https://www.googleapis.com/youtube/v3/playlistItems` +
    `?part=contentDetails&maxResults=50&playlistId=${encodeURIComponent(playlistId)}` +
    (pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : '');

  const data = await youtubeFetchJson<PlaylistItemsResponse>(url);
  const ids = (data.items || []).map((it) => it.contentDetails?.videoId).filter((v): v is string => !!v) || [];

  // 다음 호출과 충돌을 줄이려 약간의 딜레이
  await sleep(INTER_REQUEST_DELAY_MS);

  return { ids, nextPageToken: data.nextPageToken ?? null };
}

/** 여러 videoId → 상세 메타(여러 번 나눠 호출) */
export async function batchGetVideos(videoIds: string[]): Promise<YouTubeVideoMeta[]> {
  if (!YOUTUBE_API_KEY || videoIds.length === 0) return [];

  type VideosResponse = {
    items?: Array<{
      id: string;
      snippet?: {
        title?: string;
        publishedAt?: string;
        thumbnails?: {
          default?: { url?: string };
          medium?: { url?: string };
          high?: { url?: string };
        };
      };
      contentDetails?: { duration?: string };
      statistics?: { viewCount?: string; likeCount?: string };
      liveStreamingDetails?: { actualStartTime?: string; actualEndTime?: string };
    }>;
  };

  // 50개 단위로 쪼개서 순차 호출
  const chunks: string[][] = [];
  for (let i = 0; i < videoIds.length; i += MAX_VIDEO_IDS_PER_REQUEST) {
    chunks.push(videoIds.slice(i, i + MAX_VIDEO_IDS_PER_REQUEST));
  }

  const results: YouTubeVideoMeta[] = [];

  for (const chunk of chunks) {
    const url =
      `https://www.googleapis.com/youtube/v3/videos` +
      `?part=snippet,contentDetails,statistics,liveStreamingDetails` +
      `&id=${encodeURIComponent(chunk.join(','))}`;

    const data = await youtubeFetchJson<VideosResponse>(url);

    for (const v of data.items || []) {
      const durationSeconds = parseIso8601DurationToSeconds(v.contentDetails?.duration || null);
      const publishedAt = v.snippet?.publishedAt || new Date().toISOString();

      const thumbnail =
        v.snippet?.thumbnails?.high?.url ||
        v.snippet?.thumbnails?.medium?.url ||
        v.snippet?.thumbnails?.default?.url ||
        null;

      // 간단 분류: live 진행 중 / VOD(라이브 종료) / 길이로 video/short
      const isLiveNow = !!(v.liveStreamingDetails?.actualStartTime && !v.liveStreamingDetails?.actualEndTime);
      const isVodFromLive = !!v.liveStreamingDetails?.actualEndTime;

      const contentType: YouTubeVideoMeta['contentType'] = isLiveNow
        ? 'live'
        : isVodFromLive
        ? 'vod'
        : (durationSeconds ?? 0) < 60
        ? 'short'
        : 'video';

      results.push({
        id: v.id,
        title: v.snippet?.title ?? '',
        thumbnailUrl: thumbnail,
        publishedAt,
        durationSec: durationSeconds,
        viewCount: v.statistics?.viewCount ? Number(v.statistics.viewCount) : null,
        likeCount: v.statistics?.likeCount ? Number(v.statistics.likeCount) : null,
        isLive: isLiveNow,
        contentType,
      });
    }

    // 다음 청크 호출 전 잠깐 쉬어 QPS 완화
    await sleep(INTER_REQUEST_DELAY_MS);
  }

  return results;
}
