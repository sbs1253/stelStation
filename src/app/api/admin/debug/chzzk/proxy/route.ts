import { NextResponse } from 'next/server';

// 환경 변수 로드
const ADMIN_SECRET = process.env.CRON_SECRET ?? '';
const CHZZK_CLIENT_ID = process.env.CHZZK_CLIENT_ID ?? '';
const CHZZK_CLIENT_SECRET = process.env.CHZZK_CLIENT_SECRET ?? '';

// API 종류에 따른 기본 URL
const OPEN_API_BASE_URL = process.env.CHZZK_OPEN_API_BASE_URL ?? 'https://openapi.chzzk.naver.com'; // 공식 Open API (캐시 가능성 있음)
const GAME_API_BASE_URL = process.env.CHZZK_GAME_API_BASE_URL ?? 'https://api.chzzk.naver.com'; // 내부 서비스 API (실시간 데이터)
/**
 * API 요청을 보내는 범용 함수
 * @param baseUrl 요청을 보낼 기본 URL
 * @param path 요청 경로
 * @param useAuth 인증 헤더(Client-Id, Client-Secret) 사용 여부
 */
async function fetchApi(baseUrl: string, path: string, useAuth: boolean) {
  const requestUrl = `${baseUrl}${path}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10초 타임아웃

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    // 내부 API 접속을 에러 방지
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
  };

  if (useAuth) {
    headers['Client-Id'] = CHZZK_CLIENT_ID;
    headers['Client-Secret'] = CHZZK_CLIENT_SECRET;
  }

  console.log(`Requesting API: ${requestUrl}`);

  try {
    const response = await fetch(requestUrl, {
      method: 'GET',
      headers,
      cache: 'no-store',
      signal: controller.signal,
    });

    const responseText = await response.text();
    let body: any = null;
    if (responseText) {
      try {
        body = JSON.parse(responseText);
      } catch {
        body = responseText;
      }
    }

    if (!response.ok) {
      console.warn('API returned an error:', { status: response.status, body });
    }

    return NextResponse.json(
      { ok: response.ok, status: response.status, url: requestUrl, body },
      { status: response.status }
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function GET(req: Request) {
  // 1. 내부 인증 확인
  if (req.headers.get('x-cron-secret') !== ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const type = searchParams.get('type') ?? 'channel'; // 'channel' | 'live-status'

  try {
    // --- API 종류에 따라 로직 분기 ---
    if (type === 'channel') {
      // 공식 Open API를 사용한 채널 정보 조회
      if (!CHZZK_CLIENT_ID || !CHZZK_CLIENT_SECRET) {
        return NextResponse.json({ error: 'Missing CHZZK credentials for Open API.' }, { status: 500 });
      }
      // 허용 형태:
      // - channelIds=aaa,bbb  (콤마 구분)
      // - channelIds=aaa & channelIds=bbb  (반복 키)
      // - channelId=aaa  (단일 편의)
      const idsRepeated = searchParams.getAll('channelIds').filter(Boolean);
      let idsParam = searchParams.get('channelIds') || '';
      const singleId = searchParams.get('channelId') || '';

      // 우선순위: 반복키 > 단일키(콤마 포함) > channelId
      let joined = '';
      if (idsRepeated.length) {
        joined = idsRepeated.join(',');
      } else if (idsParam) {
        joined = idsParam;
      } else if (singleId) {
        joined = singleId;
      }

      if (!joined) {
        return NextResponse.json(
          { error: "Query parameter 'channelIds' (or 'channelId') is required for type=channel." },
          { status: 400 }
        );
      }

      const apiPath = `/open/v1/channels?channelIds=${encodeURIComponent(joined)}`;
      return await fetchApi(OPEN_API_BASE_URL, apiPath, true);
    } else if (type === 'live-status') {
      // 'live-detail'에서 'live-status'로 명칭 변경
      // 내부 서비스 API를 사용한 실시간 채널 전체 정보 조회 (라이브 상태 확인용)
      const channelId = searchParams.get('channelId');
      if (!channelId) {
        return NextResponse.json(
          { error: "Query parameter 'channelId' is required for type=live-status." },
          { status: 400 }
        );
      }
      // '/live-detail' 대신 채널 전체 정보를 요청하여 응답 내 liveDetail 객체 유무로 상태를 확인
      const apiPath = `/service/v1/channels/${encodeURIComponent(channelId)}`;
      return await fetchApi(GAME_API_BASE_URL, apiPath, false); // 인증 헤더 불필요
    } else if (type === 'videos') {
      // 내부 서비스 API를 사용한 채널의 다시보기 동영상 목록 조회
      const channelId = searchParams.get('channelId');
      if (!channelId) {
        return NextResponse.json(
          { error: "Query parameter 'channelId' is required for type=videos." },
          { status: 400 }
        );
      }
      // 페이징을 위한 limit, offset 파라미터 처리 (기본값 설정)
      const limit = searchParams.get('limit') ?? '20';
      const offset = searchParams.get('offset') ?? '0';
      // 기본 페이징: limit=20, offset=0

      const apiPath = `/service/v1/channels/${encodeURIComponent(channelId)}/videos?limit=${limit}&offset=${offset}`;
      return await fetchApi(GAME_API_BASE_URL, apiPath, false); // 인증 헤더 불필요
    } else {
      return NextResponse.json(
        { error: "Invalid 'type' parameter. Use 'channel' | 'live-status' | 'videos'." },
        { status: 400 }
      );
    }
  } catch (error: any) {
    console.error('API proxy failed:', {
      message: error.message,
      cause: error.cause,
    });

    return NextResponse.json(
      {
        error: 'Failed to process API request',
        details: error.message,
        cause: error.cause ? String(error.cause) : 'No specific cause available.',
      },
      { status: 502 }
    );
  }
}
