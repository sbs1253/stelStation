import { NextResponse } from 'next/server';
import { supabaseService } from '@/lib/supabase/service';
import { STEL_SEEDS } from '@/lib/config/seeds';

const ADMIN_SECRET = process.env.CRON_SECRET ?? '';

function toSlug(name: string) {
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .slice(0, 60);
}

export async function POST(req: Request) {
  if ((req.headers.get('x-cron-secret') ?? '') !== ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const created: string[] = [];
  const reused: string[] = [];
  const linked: Array<{ creatorId: string; channelId: string }> = [];
  const missingChannels: Array<{ name: string; platform: 'youtube' | 'chzzk'; key: string }> = [];

  for (const seed of STEL_SEEDS) {
    // 1) creators upsert (name/slug 기반)
    const slug = toSlug(seed.name);
    // slug 충돌 대비: slug로 먼저, 없으면 name 대소문자 무시로 조회
    let creatorId: string | null = null;

    const bySlug = await supabaseService.from('creators').select('id').eq('slug', slug).maybeSingle();

    if (bySlug.error) {
      return NextResponse.json({ error: 'DB error', details: bySlug.error.message }, { status: 500 });
    }

    if (bySlug.data?.id) {
      creatorId = bySlug.data.id;
      if (creatorId) reused.push(creatorId);
    } else {
      const byName = await supabaseService.from('creators').select('id').ilike('name', seed.name).maybeSingle();

      if (byName.error) {
        return NextResponse.json({ error: 'DB error', details: byName.error.message }, { status: 500 });
      }

      if (byName.data?.id) {
        creatorId = byName.data.id;
        if (creatorId) reused.push(creatorId);
        // slug가 비어있으면 채워줌
        await supabaseService.from('creators').update({ slug }).eq('id', creatorId);
      } else {
        const ins = await supabaseService
          .from('creators')
          .insert({ name: seed.name, gen: seed.gen ?? null, slug })
          .select('id')
          .single();
        if (ins.error) {
          return NextResponse.json({ error: 'DB error', details: ins.error.message }, { status: 500 });
        }
        creatorId = ins.data.id;
        if (creatorId) created.push(creatorId);
      }
    }

    // 2) 각 플랫폼 채널 찾기 → creator_channels upsert (onConflict: 'channel_id')
    async function linkChannel(platform: 'youtube' | 'chzzk', platformId: string) {
      const sel = await supabaseService
        .from('channels')
        .select('id')
        .eq('platform', platform)
        .eq('platform_channel_id', platformId)
        .maybeSingle();

      if (sel.error) {
        throw new Error(sel.error.message);
      }
      if (!sel.data?.id) {
        missingChannels.push({ name: seed.name, platform, key: platformId });
        return;
      }
      const channelId = sel.data.id;

      const up = await supabaseService
        .from('creator_channels')
        .upsert(
          { creator_id: creatorId!, channel_id: channelId },
          { onConflict: 'channel_id' } // 한 채널은 하나의 크리에이터만(유니크 채택 시)
        )
        .select('creator_id, channel_id')
        .single();

      if (up.error) throw new Error(up.error.message);
      linked.push({ creatorId: creatorId!, channelId });
    }

    if (seed.youtube?.ucId) await linkChannel('youtube', seed.youtube.ucId);
    if (seed.chzzk?.channelId) await linkChannel('chzzk', seed.chzzk.channelId);
  }

  return NextResponse.json({
    ok: true,
    creators: { created: created.length, reused: reused.length },
    links: linked.length,
    missingChannels, // channels 시드가 누락된 경우 확인용
  });
}
