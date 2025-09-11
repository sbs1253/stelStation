export type Platform = 'youtube' | 'chzzk';

export function makeChannelUrl(platform: Platform, platformChannelId: string): string {
  if (platform === 'youtube') {
    return `https://www.youtube.com/channel/${encodeURIComponent(platformChannelId)}`;
  }
  // chzzk
  return `https://chzzk.naver.com/${encodeURIComponent(platformChannelId)}`;
}

export function makeLiveUrl(platformChannelId: string): string {
  return `https://chzzk.naver.com/live/${encodeURIComponent(platformChannelId)}`;
}

export function makeVideoUrl(args: {
  platform: Platform;
  platformChannelId: string;
  platformVideoId: string; // e.g.'chzzk:XYZ'
  isLive?: boolean;
  contentType?: 'video' | 'short' | 'live' | 'vod';
  chzzkVideoNo?: number | null;
}): string {
  const { platform, platformChannelId, platformVideoId, isLive, contentType, chzzkVideoNo } = args;

  if (platform === 'youtube') {
    if (contentType === 'short') {
      return `https://www.youtube.com/shorts/${encodeURIComponent(platformVideoId)}`;
    }
    return `https://www.youtube.com/watch?v=${encodeURIComponent(platformVideoId)}`;
  }

  // chzzk
  if (isLive) {
    return makeLiveUrl(platformChannelId);
  }
  if (typeof chzzkVideoNo === 'number' && chzzkVideoNo > 0) {
    return `https://chzzk.naver.com/video/${chzzkVideoNo}`;
  }
  return makeChannelUrl('chzzk', platformChannelId);
}
