// src/lib/chzzk/client.ts
export type ChzzkLiveStatus = {
  isLiveNow: boolean;
  currentLiveVideoId: string | null;
  lastLiveEndedAt: string | null; // ISO
};

const CHZZK_BASE = process.env.CHZZK_API_BASE;
const CHZZK_CLIENT_ID = process.env.CHZZK_CLIENT_ID;
const CHZZK_TOKEN = process.env.CHZZK_CLIENT_SECRET;

async function czFetch<T>(path: string): Promise<T> {
  if (!CHZZK_BASE) {
    // mock: 항상 오프라인
    // @ts-expect-error
    return {};
  }
  const url = `${CHZZK_BASE.replace(/\/+$/, '')}${path}`;
  const res = await fetch(url, {
    headers: {
      // 실제 요구 헤더로 교체
      ...(CHZZK_CLIENT_ID ? { 'x-client-id': CHZZK_CLIENT_ID } : {}),
      ...(CHZZK_TOKEN ? { Authorization: `Bearer ${CHZZK_TOKEN}` } : {}),
    },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Chzzk API ${res.status}`);
  return res.json() as Promise<T>;
}

/** 채널의 라이브 상태 조회 */
export async function getChannelLiveStatus(channelExternalId: string): Promise<ChzzkLiveStatus> {
  if (!CHZZK_BASE) {
    return { isLiveNow: false, currentLiveVideoId: null, lastLiveEndedAt: null };
  }

  // TODO: 실제 엔드포인트로 교체
  // 예: GET /channels/{id}/live
  type Resp = {
    live?: { isLive?: boolean; videoId?: string; startedAt?: string; endedAt?: string };
  };
  const data = await czFetch<Resp>(`/channels/${encodeURIComponent(channelExternalId)}/live`);

  const isLiveNow = !!data.live?.isLive;
  const currentLiveVideoId = data.live?.videoId ?? null;
  // 라이브 종료가 있었다면 endedAt, 아니면 null
  const lastLiveEndedAt = data.live?.endedAt ?? null;

  return { isLiveNow, currentLiveVideoId, lastLiveEndedAt };
}
