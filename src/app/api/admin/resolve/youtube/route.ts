// app/api/admin/resolve/youtube/route.ts
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { z } from 'zod';

const ADMIN_SECRET = process.env.CRON_SECRET ?? '';
const YT_KEY = process.env.YOUTUBE_API_KEY ?? '';

const BodySchema = z.object({
  input: z.string().min(1), // @handle | 채널URL | 커스텀URL | 영상URL | UC...
});

// --- 유틸 ---
const UC_RE = /^UC[0-9A-Za-z_-]{22}$/;
function isUcId(s: string) {
  return UC_RE.test(s);
}

function parseUrlMaybe(s: string) {
  try {
    return new URL(s);
  } catch {
    return null;
  }
}

function extractVideoIdFromUrl(u: URL): string | null {
  // https://www.youtube.com/watch?v=VIDEOID or youtu.be/VIDEOID
  if (u.hostname.includes('youtu.be')) return u.pathname.slice(1) || null;
  if (u.searchParams.get('v')) return u.searchParams.get('v');
  return null;
}

async function ytFetch<T>(url: string): Promise<T> {
  if (!YT_KEY) throw new Error('Missing YOUTUBE_API_KEY');
  const sep = url.includes('?') ? '&' : '?';
  const full = `${url}${sep}key=${encodeURIComponent(YT_KEY)}`;
  const res = await fetch(full);
  if (!res.ok) throw new Error(`YouTube API ${res.status}`);
  return res.json() as Promise<T>;
}

// --- 핵심 로직 ---
export async function POST(req: Request) {
  if ((req.headers.get('x-cron-secret') ?? '') !== ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await req.json());
  } catch (e: any) {
    return NextResponse.json({ error: 'Invalid body', details: e?.issues ?? String(e) }, { status: 400 });
  }

  const raw = body.input.trim();

  // 1) 이미 UC… 형식이면 그대로 반환
  if (isUcId(raw)) {
    return NextResponse.json({
      platform: 'youtube',
      ucId: raw,
      source: 'direct',
      canonicalUrl: `https://www.youtube.com/channel/${raw}`,
    });
  }

  // 2) URL로 들어온 경우
  const u = parseUrlMaybe(raw);
  if (u) {
    // 2-a) /channel/UC... 패턴
    const parts = u.pathname.split('/').filter(Boolean);
    const idx = parts.findIndex((p) => p.toLowerCase() === 'channel');
    if (idx >= 0 && parts[idx + 1] && isUcId(parts[idx + 1])) {
      const uc = parts[idx + 1];
      return NextResponse.json({
        platform: 'youtube',
        ucId: uc,
        source: 'channelUrl',
        canonicalUrl: `https://www.youtube.com/channel/${uc}`,
      });
    }

    // 2-b) 영상 URL → videos.list로 채널ID 역추적
    const vid = extractVideoIdFromUrl(u);
    if (vid) {
      type VResp = { items?: Array<{ snippet?: { channelId?: string; channelTitle?: string } }> };
      const data = await ytFetch<VResp>(
        `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${encodeURIComponent(vid)}`
      );
      const uc = data.items?.[0]?.snippet?.channelId;
      const title = data.items?.[0]?.snippet?.channelTitle;
      if (uc && isUcId(uc)) {
        return NextResponse.json({
          platform: 'youtube',
          ucId: uc,
          source: 'videoUrl',
          candidateTitle: title ?? null,
          canonicalUrl: `https://www.youtube.com/channel/${uc}`,
        });
      }
    }

    // 2-c) /@handle, /c/CustomName 케이스 → search로 채널 찾기
    //  (handles는 공식 forHandle 파라미터가 애매하므로 search로 보편 처리)
    const q = u.pathname.replace(/^\/+/, '');
    if (q) {
      const term = q.startsWith('@') ? q : q.split('/')[0]; // "@handle" 또는 "c/Custom" 첫 토큰
      const uc = await findChannelBySearch(term);
      if (uc) {
        return NextResponse.json({
          platform: 'youtube',
          ucId: uc.ucId,
          source: 'search',
          candidateTitle: uc.title,
          canonicalUrl: `https://www.youtube.com/channel/${uc.ucId}`,
        });
      }
    }
  }

  // 3) 그냥 문자열(@handle, 커스텀명)로 왔으면 search
  const term = raw.startsWith('@') ? raw : raw.split(' ').slice(0, 5).join(' ');
  const uc = await findChannelBySearch(term);
  if (uc) {
    return NextResponse.json({
      platform: 'youtube',
      ucId: uc.ucId,
      source: 'search',
      candidateTitle: uc.title,
      canonicalUrl: `https://www.youtube.com/channel/${uc.ucId}`,
    });
  }

  return NextResponse.json({ error: 'Resolve failed' }, { status: 404 });
}

async function findChannelBySearch(q: string): Promise<{ ucId: string; title: string | null } | null> {
  type SResp = {
    items?: Array<{ id?: { channelId?: string }; snippet?: { channelTitle?: string } }>;
  };
  const data = await ytFetch<SResp>(
    `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&maxResults=1&q=${encodeURIComponent(q)}`
  );
  const item = data.items?.[0];
  const id = item?.id?.channelId;
  if (id && isUcId(id)) {
    return { ucId: id, title: item?.snippet?.channelTitle ?? null };
  }
  return null;
}
