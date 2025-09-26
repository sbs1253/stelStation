'use client';
import { useMemo } from 'react';
import { useChannelsQuery } from '@/features/feed/hooks/useChannelsQuery';
import { buildCreatorsFromChannels } from '@/features/feed/utils/buildCreators';
import { useUrlFeedState } from '@/features/feed/hooks/useUrlFeedState';
import type { CreatorSidebarItem } from '@/features/creator/types';
export default function CreatorSidebar({ className }: { className?: string }) {
  const { data: channels = [], status } = useChannelsQuery();
  const creators = useMemo(() => buildCreatorsFromChannels(channels), [channels]);
  const { setParams } = useUrlFeedState();

  const selectAll = () => {
    setParams({
      platform: 'all',
      creatorId: null,
      channelIds: [],
      scope: 'all',
    });
  };

  const selectCreator = (c: CreatorSidebarItem) => {
    setParams({
      platform: 'all',
      filterType: 'all',
      sort: 'published',
      creatorId: c.creatorId,
      channelIds: c.channelIds,
      scope: 'channels',
    });
  };

  return (
    <aside className={`w-64 border-r p-3 ${className ?? ''}`}>
      <div className="mb-3">
        <button className="w-full text-left px-3 py-2 rounded hover:bg-muted" onClick={selectAll}>
          전체 크리에이터
        </button>
      </div>

      {status === 'pending' && <div className="p-2 text-sm text-muted-foreground">로딩 중…</div>}
      {status === 'error' && <div className="p-2 text-sm text-red-600">채널 목록을 불러오지 못했습니다.</div>}
      {status === 'success' && (
        <ul className="space-y-1">
          {creators.map((c) => (
            <li key={c.creatorId}>
              <button
                className="w-full flex items-center gap-2 px-3 py-2 rounded hover:bg-muted"
                onClick={() => selectCreator(c)}
              >
                {/* 썸네일/라이브뱃지 등은 나중에 꾸미자 */}
                <span className="flex-1 text-left truncate">{c.name}</span>
                {c.isLiveNow && <span className="text-xs text-red-600">LIVE</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
