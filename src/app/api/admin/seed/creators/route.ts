import { NextResponse } from 'next/server';
import { supabaseService } from '@/lib/supabase/service';
import { STEL_SEEDS } from '@/lib/config/seeds';

const ADMIN_SECRET = process.env.CRON_SECRET ?? '';

async function linkChannel(
  creatorId: string,
  seedName: string,
  platform: 'youtube' | 'chzzk',
  platformId: string,
  dryRun: boolean
): Promise<{ status: 'linked'; channelId: string } | { status: 'missing' } | { status: 'error'; message: string }> {
  // 1) 채널 존재 확인
  const sel = await supabaseService
    .from('channels')
    .select('id')
    .eq('platform', platform)
    .eq('platform_channel_id', platformId)
    .maybeSingle();

  if (sel.error) {
    return { status: 'error', message: sel.error.message };
  }
  if (!sel.data?.id) {
    return { status: 'missing' };
  }

  const channelId = sel.data.id;

  // 2) dry-run이면 실제 연결 없이 결과만
  if (dryRun) {
    return { status: 'linked', channelId };
  }

  // 3) 연결 upsert (채널 하나는 하나의 크리에이터에만 매핑)
  const up = await supabaseService
    .from('creator_channels')
    .upsert({ creator_id: creatorId, channel_id: channelId }, { onConflict: 'channel_id' })
    .select('creator_id, channel_id')
    .single();

  if (up.error) {
    return { status: 'error', message: up.error.message };
  }

  return { status: 'linked', channelId };
}

/** 크리에이터 slug 생성: 소문자-하이픈, 영숫자/언더스코어만, 최대 60자 */
function toSlug(name: string) {
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .slice(0, 60);
}

export async function POST(req: Request) {
  // 내부 보호
  if ((req.headers.get('x-cron-secret') ?? '') !== ADMIN_SECRET) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const startedAt = new Date();
  const url = new URL(req.url);
  const dryRun = (url.searchParams.get('dryRun') ?? '') === '1';
  const verbose = (url.searchParams.get('verbose') ?? '') === '1';

  // 집계 컨테이너
  const created: string[] = [];
  const reused: string[] = [];
  const linked: Array<{ creatorId: string; channelId: string }> = [];
  const missingChannels: Array<{ name: string; platform: 'youtube' | 'chzzk'; key: string }> = [];
  const errors: Array<{ step: 'creator' | 'link'; seedName: string; message: string }> = [];

  // 메인 루프
  for (const seed of STEL_SEEDS) {
    const slug = toSlug(seed.name);
    const desiredXUrl = seed.x ?? null;
    let creatorId: string | null = null;
    let currentXUrl: string | null | undefined = undefined;

    // 1) slug로 조회 → 없으면 name(대소문자 무시)로 조회
    const bySlug = await supabaseService.from('creators').select('id, x_url').eq('slug', slug).maybeSingle();
    if (bySlug.error) {
      errors.push({ step: 'creator', seedName: seed.name, message: bySlug.error.message });
      continue;
    }

    if (bySlug.data?.id) {
      creatorId = bySlug.data.id;
      currentXUrl = bySlug.data.x_url ?? null;
      reused.push(creatorId as string);
    } else {
      const byName = await supabaseService
        .from('creators')
        .select('id, slug, x_url')
        .ilike('name', seed.name)
        .maybeSingle();
      if (byName.error) {
        errors.push({ step: 'creator', seedName: seed.name, message: byName.error.message });
        continue;
      }

      if (byName.data?.id) {
        creatorId = byName.data.id;
        currentXUrl = byName.data.x_url ?? null;
        reused.push(creatorId as string);

        // slug가 비어있다면 채워줌(드라이런 아님 + slug 다를 때)
        if (!dryRun) {
          const updatePayload: Record<string, string | null> = {};
          if (!byName.data.slug || byName.data.slug !== slug) {
            updatePayload.slug = slug;
          }
          if (desiredXUrl !== currentXUrl) {
            updatePayload.x_url = desiredXUrl;
            currentXUrl = desiredXUrl;
          }

          if (Object.keys(updatePayload).length) {
            const upd = await supabaseService.from('creators').update(updatePayload).eq('id', creatorId);
            if (upd.error) {
              errors.push({ step: 'creator', seedName: seed.name, message: upd.error.message });
            }
          }
        }

        if (dryRun && desiredXUrl !== currentXUrl) {
          // dry-run 상태에서도 차이를 알 수 있도록만 기록
          currentXUrl = desiredXUrl;
        }
      } else {
        // 새로 생성
        if (dryRun) {
          // 생성만 계획
          const fakeId = `planned:${slug}`;
          created.push(fakeId);
          creatorId = fakeId;
        } else {
          const ins = await supabaseService
            .from('creators')
            .insert({ name: seed.name, gen: seed.gen ?? null, slug, x_url: desiredXUrl })
            .select('id')
            .single();

          if (ins.error) {
            errors.push({ step: 'creator', seedName: seed.name, message: ins.error.message });
            continue;
          }

          creatorId = ins.data.id;
          created.push(creatorId as string);
          currentXUrl = desiredXUrl;
        }
      }
    }

    if (!dryRun && creatorId && currentXUrl !== desiredXUrl) {
      const { error: updateErr } = await supabaseService
        .from('creators')
        .update({ x_url: desiredXUrl })
        .eq('id', creatorId);
      if (updateErr) {
        errors.push({ step: 'creator', seedName: seed.name, message: updateErr.message });
      }
    }

    // 2) 플랫폼별 채널 링크 (채널 미존재 시 missingChannels에 기록)
    if (creatorId) {
      if (seed.youtube?.ucId) {
        const res = await linkChannel(creatorId, seed.name, 'youtube', seed.youtube.ucId, dryRun);
        if (res.status === 'linked') {
          linked.push({ creatorId, channelId: res.channelId });
        } else if (res.status === 'missing') {
          missingChannels.push({ name: seed.name, platform: 'youtube', key: seed.youtube.ucId });
        } else {
          errors.push({ step: 'link', seedName: seed.name, message: res.message });
        }
      }
      if (seed.chzzk?.channelId) {
        const res = await linkChannel(creatorId, seed.name, 'chzzk', seed.chzzk.channelId, dryRun);
        if (res.status === 'linked') {
          linked.push({ creatorId, channelId: res.channelId });
        } else if (res.status === 'missing') {
          missingChannels.push({ name: seed.name, platform: 'chzzk', key: seed.chzzk.channelId });
        } else {
          errors.push({ step: 'link', seedName: seed.name, message: res.message });
        }
      }
    }
  }

  const finishedAt = new Date();
  const durationMs = finishedAt.getTime() - startedAt.getTime();

  return NextResponse.json({
    ok: true,
    parameters: { dryRun, verbose, seeds: STEL_SEEDS.length },
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs,
    creators: { created: created.length, reused: reused.length },
    links: linked.length,
    missingChannels,
    ...(verbose
      ? {
          detail: {
            created,
            reused,
            linked,
          },
        }
      : {}),
    ...(errors.length ? { errors } : {}),
  });
}
