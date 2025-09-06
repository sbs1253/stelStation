// app/api/admin/resolve/youtube/route.ts

import { NextResponse } from 'next/server';
import { z } from 'zod';

const ADMIN_SECRET = process.env.CRON_SECRET ?? '';
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY ?? '';

const RequestBodySchema = z.object({
  input: z.string().min(1), // @handle | 채널URL | 커스텀URL | 영상URL | UC...
});

// --- 유틸 ---
const YOUTUBE_UC_ID_REGEX = /^UC[0-9A-Za-z_-]{22}$/;
function isYoutubeChannelId(value: string) {
  return YOUTUBE_UC_ID_REGEX.test(value);
}

function tryParseUrl(raw: string) {
  try {
    return new URL(raw);
  } catch {
    return null;
  }
}

function extractVideoIdFromUrl(url: URL): string | null {
  // https://www.youtube.com/watch?v=VIDEOID or youtu.be/VIDEOID
  if (url.hostname.includes('youtu.be')) return url.pathname.slice(1) || null;
  if (url.searchParams.get('v')) return url.searchParams.get('v');
  // https://www.youtube.com/shorts/VIDEOID
  if (url.pathname.startsWith('/shorts/')) {
    const seg = url.pathname.split('/').filter(Boolean)[1];
    if (seg) return seg;
  }
  return null;
}

async function youtubeFetchJson<T>(url: string): Promise<T> {
  if (!YOUTUBE_API_KEY) throw new Error('Missing YOUTUBE_API_KEY');
  const sep = url.includes('?') ? '&' : '?';
  const full = `${url}${sep}key=${encodeURIComponent(YOUTUBE_API_KEY)}`;
  const res = await fetch(full);
  if (!res.ok) throw new Error(`YouTube API ${res.status}`);
  return res.json() as Promise<T>;
}

// --- 핵심 로직 ---
export async function POST(req: Request) {
  if ((req.headers.get('x-cron-secret') ?? '') !== ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Optional verbose flag for admin debugging
  const sp = new URL(req.url).searchParams;
  const verbose = (sp.get('verbose') ?? '') === '1';

  // Early guard for missing API key to return a friendly error
  if (!YOUTUBE_API_KEY) {
    return NextResponse.json(
      { error: 'Missing YOUTUBE_API_KEY', hint: 'Set YOUTUBE_API_KEY in environment to use this admin resolver.' },
      { status: 500 }
    );
  }

  let body: z.infer<typeof RequestBodySchema>;
  try {
    body = RequestBodySchema.parse(await req.json());
  } catch (e: any) {
    return NextResponse.json({ error: 'Invalid body', details: e?.issues ?? String(e) }, { status: 400 });
  }

  const rawInput = body.input.trim();

  // 1) 이미 UC… 형식이면 그대로 반환
  if (isYoutubeChannelId(rawInput)) {
    return NextResponse.json({
      platform: 'youtube',
      ucId: rawInput,
      source: 'direct',
      canonicalUrl: `https://www.youtube.com/channel/${rawInput}`,
      ...(verbose ? { debug: { input: rawInput, pathTaken: 'uc' } } : {}),
    });
  }

  // 2) URL로 들어온 경우
  const parsedUrl = tryParseUrl(rawInput);
  if (parsedUrl) {
    // 2-a) /channel/UC... 패턴
    const pathSegments = parsedUrl.pathname.split('/').filter(Boolean);
    const channelIdx = pathSegments.findIndex((p) => p.toLowerCase() === 'channel');
    if (channelIdx >= 0 && pathSegments[channelIdx + 1] && isYoutubeChannelId(pathSegments[channelIdx + 1])) {
      const youtubeChannelId = pathSegments[channelIdx + 1];
      return NextResponse.json({
        platform: 'youtube',
        ucId: youtubeChannelId,
        source: 'channelUrl',
        canonicalUrl: `https://www.youtube.com/channel/${youtubeChannelId}`,
        ...(verbose ? { debug: { input: rawInput, pathTaken: 'channelUrl' } } : {}),
      });
    }

    // 2-b) 영상 URL → videos.list로 채널ID 역추적
    const videoId = extractVideoIdFromUrl(parsedUrl);
    if (videoId) {
      try {
        type VideoListResponse = { items?: Array<{ snippet?: { channelId?: string; channelTitle?: string } }> };
        const data = await youtubeFetchJson<VideoListResponse>(
          `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${encodeURIComponent(videoId)}`
        );
        const youtubeChannelId = data.items?.[0]?.snippet?.channelId;
        const channelTitle = data.items?.[0]?.snippet?.channelTitle;
        if (youtubeChannelId && isYoutubeChannelId(youtubeChannelId)) {
          return NextResponse.json({
            platform: 'youtube',
            ucId: youtubeChannelId,
            source: 'videoUrl',
            candidateTitle: channelTitle ?? null,
            canonicalUrl: `https://www.youtube.com/channel/${youtubeChannelId}`,
            ...(verbose ? { debug: { input: rawInput, pathTaken: 'videoUrl', videoId } } : {}),
          });
        }
      } catch (e: any) {
        return NextResponse.json(
          { error: 'YouTube API error (videos.list)', details: String(e?.message ?? e) },
          { status: 502 }
        );
      }
    }

    // 2-c) /@handle, /c/CustomName, /user/Name → search로 채널 찾기
    const pathSegments2 = parsedUrl.pathname.split('/').filter(Boolean);
    let termFromPath = '';
    if (pathSegments2[0]?.startsWith('@')) {
      termFromPath = pathSegments2[0];
    } else if ((pathSegments2[0] === 'c' || pathSegments2[0] === 'user') && pathSegments2[1]) {
      termFromPath = pathSegments2[1];
    } else if (pathSegments2[0]) {
      termFromPath = pathSegments2[0];
    }

    if (termFromPath) {
      try {
        const found = await findChannelBySearch(termFromPath);
        if (found) {
          return NextResponse.json({
            platform: 'youtube',
            ucId: found.ucId,
            source: 'search',
            candidateTitle: found.title,
            canonicalUrl: `https://www.youtube.com/channel/${found.ucId}`,
            ...(verbose ? { debug: { input: rawInput, pathTaken: 'searchFromUrl', term: termFromPath } } : {}),
          });
        }
      } catch (e: any) {
        return NextResponse.json({ error: 'YouTube search failed', details: String(e?.message ?? e) }, { status: 502 });
      }
    }
  }

  // 3) 그냥 문자열(@handle, 커스텀명)로 왔으면 search
  try {
    const searchTerm = rawInput.startsWith('@') ? rawInput : rawInput.split(' ').slice(0, 5).join(' ');
    const found = await findChannelBySearch(searchTerm);
    if (found) {
      return NextResponse.json({
        platform: 'youtube',
        ucId: found.ucId,
        source: 'search',
        candidateTitle: found.title,
        canonicalUrl: `https://www.youtube.com/channel/${found.ucId}`,
        ...(verbose ? { debug: { input: rawInput, pathTaken: 'searchFromText', term: searchTerm } } : {}),
      });
    }
  } catch (e: any) {
    return NextResponse.json({ error: 'YouTube search failed', details: String(e?.message ?? e) }, { status: 502 });
  }

  return NextResponse.json(
    { error: 'Resolve failed', ...(verbose ? { debug: { input: rawInput } } : {}) },
    { status: 404 }
  );
}

async function findChannelBySearch(q: string): Promise<{ ucId: string; title: string | null } | null> {
  type SearchResponse = {
    items?: Array<{ id?: { channelId?: string }; snippet?: { channelTitle?: string } }>;
  };
  const data = await youtubeFetchJson<SearchResponse>(
    `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&maxResults=1&q=${encodeURIComponent(q)}`
  );
  const item = data.items?.[0];
  const channelId = item?.id?.channelId;
  if (channelId && isYoutubeChannelId(channelId)) {
    return { ucId: channelId, title: item?.snippet?.channelTitle ?? null };
  }
  return null;
}
