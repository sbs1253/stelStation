import { NextResponse } from 'next/server';
import { fetchYoutubeChannelRaw, getYoutubeChannelMeta } from '@/lib/youtube/client';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const ucid = url.searchParams.get('ucid'); // 예: UCQmcltnre6aG9SkDRYZqFIg
  const includeRaw = url.searchParams.get('raw') === '1';

  if (!ucid) {
    return NextResponse.json({ error: 'Missing ucid' }, { status: 400 });
  }

  // 정규화 메타
  const meta = await getYoutubeChannelMeta(ucid);

  if (!includeRaw) {
    return NextResponse.json({ ok: !!meta, ucid, meta });
  }

  // RAW도 같이 보고 싶을 때
  const raw = await fetchYoutubeChannelRaw(ucid);
  return NextResponse.json({ ok: !!meta, ucid, meta, raw });
}
