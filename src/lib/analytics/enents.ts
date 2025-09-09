// src/lib/analytics/events.ts
import { sendGaEvent } from './ga';

export function trackClickChannel(params: {
  channel_id: string;
  platform: 'youtube' | 'chzzk';
  location: 'sidebar' | 'grid' | 'feed';
}) {
  sendGaEvent('click_channel', params);
}

export function trackChangeTab(params: { tab: 'all' | 'youtube' | 'chzzk' }) {
  sendGaEvent('change_tab', params);
}

export function trackApplyFilter(params: { filter: string; value?: string }) {
  sendGaEvent('apply_filter', params);
}

export function trackRefreshFeed(params?: { scope?: 'creator' | 'all' }) {
  sendGaEvent('refresh_feed', params);
}
