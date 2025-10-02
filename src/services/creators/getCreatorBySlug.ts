import { cache } from 'react';
import { supabaseService } from '@/lib/supabase/service';

type CreatorSlugData = {
  id: string;
  name: string | null;
  channelIds: string[];
};

async function fetchCreatorBySlug(slug: string): Promise<CreatorSlugData | null> {
  const normalized = slug.trim().toLowerCase();
  if (!normalized) return null;

  const { data: creator, error } = await supabaseService
    .from('creators')
    .select('id, name')
    .eq('slug', normalized)
    .maybeSingle();

  if (error || !creator?.id) {
    return null;
  }

  const { data: mappings, error: mappingError } = await supabaseService
    .from('creator_channels')
    .select('channel_id')
    .eq('creator_id', creator.id);
  if (mappingError) {
    return null;
  }

  const channelIds = Array.from(
    new Set((mappings ?? []).map((row) => row.channel_id).filter((id): id is string => Boolean(id)))
  ).sort();

  return {
    id: creator.id,
    name: creator.name ?? null,
    channelIds,
  };
}

export const getCreatorBySlug = cache(fetchCreatorBySlug);
