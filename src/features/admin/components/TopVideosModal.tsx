import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import type { TopVideo } from '@/features/admin/types';
import Image from 'next/image';

type TopVideosModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  videos: TopVideo[];
  isLoading?: boolean;
};

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
}

function getVideoUrl(video: TopVideo): string {
  if (video.platform === 'youtube') {
    if (video.contentType === 'short') {
      return `https://www.youtube.com/shorts/${video.videoId}`;
    }
    return `https://www.youtube.com/watch?v=${video.videoId}`;
  }
  // Chzzk
  const videoId = video.videoId.replace('chzzk:', '');
  return `https://chzzk.naver.com/video/${videoId}`;
}

function getContentTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    video: '영상',
    short: '쇼츠',
    vod: 'VOD',
    live: '라이브',
  };
  return labels[type] || type;
}

function getPlatformColor(platform: string): string {
  return platform === 'youtube' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700';
}

export function TopVideosModal({ open, onOpenChange, videos, isLoading }: TopVideosModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">Top 10 인기 영상</DialogTitle>
          <DialogDescription>최근 120일 내 가장 높은 조회수를 기록한 영상들입니다</DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-4">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-200 animate-pulse rounded-lg" />
            ))}
          </div>
        ) : videos.length === 0 ? (
          <div className="text-center py-12 text-gray-500">영상 데이터가 없습니다</div>
        ) : (
          <div className="space-y-4">
            {videos.map((video, index) => (
              <a
                key={video.videoId}
                href={getVideoUrl(video)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex gap-4 p-4 rounded-lg border hover:bg-gray-50 transition-colors group"
              >
                {/* 순위 */}
                <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-primary text-primary-foreground font-bold">
                  {index + 1}
                </div>

                {/* 썸네일 */}
                {video.thumbnailUrl && (
                  <div className="relative w-40 h-24 flex-shrink-0 rounded overflow-hidden">
                    <Image
                      src={video.thumbnailUrl}
                      alt={video.title}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform"
                    />
                  </div>
                )}

                {/* 정보 */}
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2 group-hover:text-primary transition-colors">
                    {video.title}
                  </h3>

                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <Badge variant="outline" className={getPlatformColor(video.platform)}>
                      {video.platform === 'youtube' ? 'YouTube' : 'Chzzk'}
                    </Badge>
                    <Badge variant="outline">{getContentTypeLabel(video.contentType)}</Badge>
                    <span className="text-sm text-gray-600">{video.channelName}</span>
                  </div>

                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <span className="font-semibold text-gray-900">{formatNumber(video.views)} 조회</span>
                    <span>•</span>
                    <span>{formatDate(video.publishedAt)}</span>
                  </div>
                </div>
              </a>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
