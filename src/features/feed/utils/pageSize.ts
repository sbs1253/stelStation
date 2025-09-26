import type { FeedScope } from '../types';

export const CHANNEL_SCOPE_PAGE_SIZE = 16;
export const DEFAULT_PAGE_SIZE = 16;

export function getFeedPageSize(scope: FeedScope): number {
  return scope === 'channels' ? CHANNEL_SCOPE_PAGE_SIZE : DEFAULT_PAGE_SIZE;
}
