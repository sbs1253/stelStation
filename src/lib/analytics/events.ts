import { sendGaEvent } from './ga';

/** 1) 콘텐츠(영상/라이브/쇼츠 등) 선택 */
export function trackSelectContent(params: {
  item_id: string;
  content_type: 'all' | 'video' | 'live' | 'short' | 'vod';
  item_name?: string;
  platform?: 'all' | 'youtube' | 'chzzk';
}) {
  sendGaEvent('select_content', params);
}

/** 2) 리스트(사이드바/그리드/피드)에서 채널 항목 선택 */
export function trackSelectItem(params: {
  item_id: string;
  item_name?: string;
  platform?: 'all' | 'youtube' | 'chzzk';
  item_list_name: 'sidebar' | 'sidebar_avatar' | 'feed_avatar' | 'feed_channel_title';
}) {
  sendGaEvent('select_item', {
    items: [{ item_id: params.item_id, item_name: params.item_name, platform: params.platform }],
    item_list_name: params.item_list_name,
  });
}

/** 3) 외부 링크(유튜브, 치지직 등) 클릭 */
export function trackClickOutboundLink(params: {
  creator_id: string; // 어떤 크리에이터의 링크인지
  creator_name?: string;
  platform: 'youtube' | 'chzzk' | 'x'; // 어떤 플랫폼 링크인지
  location: 'sidebar' | 'feed'; // 어느 위치에서 클릭했는지
}) {
  sendGaEvent('click_outbound_link', params);
}

/** 4) 현재 리스트 맥락(플랫폼/정렬/타입)으로 보기 전환됨 */
export function trackViewItemList(params: {
  item_list_name: string; // 예: "youtube/views_day/live"
  items?: Array<{ item_id: string; item_name?: string }>;
}) {
  sendGaEvent('view_item_list', {
    item_list_name: params.item_list_name,
    ...(params.items?.length ? { items: params.items } : {}),
  });
}

/** 5) 탭/플랫폼 전환(커스텀) */
export function trackChangeTab(params: { platform: 'all' | 'youtube' | 'chzzk' }) {
  sendGaEvent('change_tab', params);
}

/** 6) 정렬/콘텐츠타입 변경(커스텀) */
export function trackChangeFilter(params: { filter_name: 'sort' | 'contentType'; filter_value: string }) {
  sendGaEvent('change_filter', params);
}

/** 7) 수동 새로고침(커스텀) */
export function trackRefresh(params?: { location?: 'sidebar' | 'feed' }) {
  sendGaEvent('refresh', params);
}
