import { z } from 'zod';

const listSchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().min(1).optional().nullable(),
  q: z.string().trim().min(1).optional().nullable(),
});

export function parseChannelListQueryFromURL(url: URL) {
  const obj = {
    limit: url.searchParams.get('limit') ?? undefined,
    cursor: url.searchParams.get('cursor') ?? undefined,
    q: url.searchParams.get('q') ?? undefined,
  };
  return listSchema.parse(obj);
}

const videosSchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().min(1).optional().nullable(),
});
export function parseChannelVideosQueryFromURL(url: URL) {
  const obj = {
    limit: url.searchParams.get('limit') ?? undefined,
    cursor: url.searchParams.get('cursor') ?? undefined,
  };
  return videosSchema.parse(obj);
}
