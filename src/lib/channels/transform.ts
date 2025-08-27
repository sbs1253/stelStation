export function mapChannelRowToItem(row: any) {
  return {
    id: row.channel_id,
    title: row.title ?? '',
    thumbnailUrl: row.thumbnail_url ?? null,
    recentPublishedAt: row.recent_published_at,
    videoCount120d: Number(row.video_count_120d ?? 0),
  };
}
