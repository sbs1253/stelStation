import { z } from 'zod';

export const SyncChannelBodySchema = z.object({
  channelId: z.string().uuid(),
  mode: z.enum(['recent', 'full']).default('recent'),
  force: z.boolean().optional(), // 쿨타임 무시(운영용)
});

export function parseSyncBody(body: unknown) {
  return SyncChannelBodySchema.parse(body);
}
