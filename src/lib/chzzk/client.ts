// API 종류에 따른 기본 URL
const OPEN_API_BASE_URL = process.env.CHZZK_OPEN_API_BASE_URL ?? 'https://openapi.chzzk.naver.com';
const SERVICE_API_BASE_URL = process.env.CHZZK_SERVICE_API_BASE_URL ?? 'https://api.chzzk.naver.com';

// 인증 정보
const CHZZK_CLIENT_ID = process.env.CHZZK_CLIENT_ID ?? '';
const CHZZK_CLIENT_SECRET = process.env.CHZZK_CLIENT_SECRET ?? '';

// --- 타입 정의 ---

// 공식 Open API 응답 타입
type ChzzkOpenChannel = {
  channelId: string;
  channelName: string;
  channelImageUrl: string | null;
  followerCount: number | null;
  verifiedMark: boolean | null;
};

type ChzzkOpenChannelsResponse = {
  code: number;
  message: string | null;
  content?: { data?: ChzzkOpenChannel[] };
};

// 내부 Service API (채널 정보) 타입을 더 상세하게 정의
type ChzzkServiceChannel = {
  channelId: string;
  channelName: string;
  channelImageUrl: string | null;
  channelDescription: string;
  followerCount: number;
  openLive: boolean;
};

type ChzzkServiceChannelResponse = {
  code: number;
  message: string | null;
  content?: ChzzkServiceChannel;
};

// 내부 Service API (비디오 목록) 응답 타입
type ChzzkServiceVideoItem = {
  videoNo: number;
  videoId: string;
  videoTitle: string;
  videoType: 'REPLAY' | 'LIVE' | 'VOD' | 'CLIP' | string;
  publishDate?: string; // "yyyy-MM-dd HH:mm:ss"
  publishDateAt?: number; // epoch millis
  thumbnailImageUrl?: string | null;
  duration?: number | null; // seconds
  readCount?: number | null;
  livePv?: number | null;
};

type ChzzkServiceVideosResponse = {
  code: number;
  message: string | null;
  content?: {
    page: number;
    size: number;
    totalCount: number;
    totalPages: number;
    data?: ChzzkServiceVideoItem[];
  };
};

// videos_cache 테이블 스키마에 맞는 타입 정의 (타입 안정성 강화)
type VideoCacheRow = {
  channel_id: string;
  platform_video_id: string;
  title: string;
  thumbnail_url: string | null;
  published_at: string; // ISO
  duration_sec: number | null;
  view_count: number | null;
  like_count: number | null;
  content_type: 'video' | 'short' | 'live' | 'vod';
  is_live: boolean;
  chzzk_video_no: number | null;
};

/** 공통 fetch (타임아웃 포함) */
async function fetchJsonWithTimeout<T>(url: string, headers: Record<string, string>, timeoutMs = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers, cache: 'no-store', signal: controller.signal });
    const text = await res.text();
    const body = text ? (JSON.parse(text) as T) : ({} as T);
    return { ok: res.ok, status: res.status, body };
  } finally {
    clearTimeout(timer);
  }
}

/** (Open API) 채널 메타 다건 조회 — 최대 100개/배치 */
export async function getChzzkChannelsMetaMap(channelIds: string[]): Promise<Map<string, ChzzkOpenChannel>> {
  const result = new Map<string, ChzzkOpenChannel>();
  if (!channelIds.length) return result;

  // 공식 API는 100개까지 한번에 조회가 가능하여 효율을 높입니다.
  for (let i = 0; i < channelIds.length; i += 100) {
    const chunk = channelIds.slice(i, i + 100);
    const url = `${OPEN_API_BASE_URL}/open/v1/channels?channelIds=` + encodeURIComponent(chunk.join(','));

    const { ok, status, body } = await fetchJsonWithTimeout<ChzzkOpenChannelsResponse>(url, {
      'Content-Type': 'application/json',
      'Client-Id': CHZZK_CLIENT_ID,
      'Client-Secret': CHZZK_CLIENT_SECRET,
    });
    if (!ok) {
      // throw new Error(`Chzzk Open API error ${status}`);
      console.error(`Chzzk Open API error ${status}`, body);
      continue; // 에러 발생 시 다음 청크로 넘어가도록 하여 안정성 확보
    }

    const list = body?.content?.data ?? [];
    for (const item of list) {
      result.set(item.channelId, item);
    }
  }
  return result;
}

/** (Open API) 채널 메타 단건 편의 함수 */
export async function getChzzkChannelMeta(channelId: string): Promise<ChzzkOpenChannel | null> {
  const map = await getChzzkChannelsMetaMap([channelId]);
  return map.get(channelId) ?? null;
}

/** (Service API v2) 채널 라이브 디테일 조회 */
type ChzzkLiveDetail = {
  liveId: number;
  liveTitle: string;
  status: 'OPEN' | 'CLOSE';
  liveImageUrl: string | null;
  defaultThumbnailImageUrl: string | null;
  concurrentUserCount: number | null;
  openDate: string; // "yyyy-MM-dd HH:mm:ss"
  closeDate: string | null;
  adult: boolean | null;
  chatChannelId: string | null;
  categoryType: string | null;
  liveCategory?: string | null;
};

type ChzzkLiveDetailResponse = {
  code: number;
  message: string | null;
  content?: ChzzkLiveDetail | null;
};

export async function getChzzkLiveStatus(channelId: string): Promise<{
  openLive: boolean;
  liveDetail?: {
    liveId: number;
    liveTitle: string;
    liveImageUrl: string | null;
    concurrentUserCount: number | null;
    categoryType: string | null;
    openDate: string; // original KST string "yyyy-MM-dd HH:mm:ss"
    closeDate: string | null;
    status: 'OPEN' | 'CLOSE';
    adult: boolean | null;
    chatChannelId: string | null;
  };
} | null> {
  const url = `${SERVICE_API_BASE_URL}/service/v2/channels/${encodeURIComponent(channelId)}/live-detail`;

  const { ok, status, body } = await fetchJsonWithTimeout<ChzzkLiveDetailResponse>(url, {
    'Content-Type': 'application/json',
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128 Safari/537.36',
  });

  if (!ok) {
    console.error(`Chzzk Service API (live-detail) error ${status}`, body);
    return null;
  }

  const content = body?.content ?? null;
  if (!content) {
    return { openLive: false };
  }

  const isLive = content.status === 'OPEN';
  return {
    openLive: isLive,
    liveDetail: isLive
      ? {
          liveId: content.liveId,
          liveTitle: content.liveTitle,
          liveImageUrl: content.liveImageUrl || content.defaultThumbnailImageUrl || null,
          concurrentUserCount: content.concurrentUserCount ?? null,
          categoryType: content.categoryType ?? content.liveCategory ?? null,
          openDate: content.openDate,
          closeDate: content.closeDate,
          status: content.status,
          adult: content.adult ?? null,
          chatChannelId: content.chatChannelId ?? null,
        }
      : undefined,
  };
}

/** (Service API) 채널 VOD 목록 1페이지 */
export async function getChzzkVideosPage(
  channelId: string,
  limit = 20,
  offset = 0
): Promise<{ items: ChzzkServiceVideoItem[]; page: number; totalPages: number }> {
  const url =
    `${SERVICE_API_BASE_URL}/service/v1/channels/${encodeURIComponent(channelId)}` +
    `/videos?limit=${limit}&offset=${offset}`;

  const { ok, status, body } = await fetchJsonWithTimeout<ChzzkServiceVideosResponse>(url, {
    'Content-Type': 'application/json',
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128 Safari/537.36',
  });

  if (!ok) {
    console.error(`Chzzk Service API videos error ${status}`, body);
    // 에러 발생 시 빈 배열을 반환하여 안정성 확보
    return { items: [], page: 0, totalPages: 1 };
  }

  const content = body?.content;
  return {
    items: content?.data ?? [],
    page: content?.page ?? 0,
    totalPages: content?.totalPages ?? 1,
  };
}

/** CHZZK 비디오 → videos_cache 업서트 행으로 변환 */
export function mapChzzkVideoToCacheRow(channelUuid: string, v: ChzzkServiceVideoItem): VideoCacheRow {
  // content_type 매핑
  const contentType =
    v.videoType === 'LIVE' ? 'live' : v.videoType === 'REPLAY' || v.videoType === 'VOD' ? 'vod' : 'video';

  const publishedIso =
    typeof v.publishDateAt === 'number'
      ? new Date(v.publishDateAt).toISOString()
      : v.publishDate
      ? new Date(v.publishDate.replace(' ', 'T') + '+09:00').toISOString()
      : new Date().toISOString();

  return {
    channel_id: channelUuid,
    // 다른 플랫폼과 ID 충돌을 막기 위해 'chzzk:' 접두사를 붙여줍니다.
    platform_video_id: `chzzk:${v.videoId}`,
    title: v.videoTitle ?? '',
    thumbnail_url: v.thumbnailImageUrl ?? null,
    published_at: publishedIso,
    duration_sec: typeof v.duration === 'number' ? v.duration : null,
    view_count: typeof v.readCount === 'number' ? v.readCount : null,
    like_count: null, // 제공 X
    is_live: contentType === 'live',
    content_type: contentType as 'video' | 'short' | 'live' | 'vod',
    chzzk_video_no: typeof v.videoNo === 'number' ? v.videoNo : null,
  };
}
