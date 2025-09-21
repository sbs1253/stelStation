// KST(Asia/Seoul) 기준의 "YYYY-MM-DD"를 안정적으로 반환 (en-CA의 반환형식)

const KST_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
const KST_FRIENDLY_DATE_FORMATTER = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: 'long',
  day: 'numeric',
});
const KST_DATE_TIME_FORMATTER = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
  hour12: true,
});

export function formatKSTDate(date: Date): string {
  return KST_FORMATTER.format(date);
}
export function formatKSTFriendlyDate(date: Date): string {
  return KST_FRIENDLY_DATE_FORMATTER.format(date);
}
export function formatKSTLiveTime(date: Date): string {
  return KST_DATE_TIME_FORMATTER.format(date);
}

export function kstToday(now: Date = new Date()): string {
  return formatKSTDate(now);
}

export function kstDaysAgo(days: number, now: Date = new Date()): string {
  const d = new Date(now);
  d.setDate(d.getDate() - days);
  return formatKSTDate(d);
}

/** 인기 정렬 기준일(일간=어제, 주간=7일 전) - 현재는 RPC가 내부 계산하므로 선택적으로 사용 */
export function baselineFor(kind: 'views_day' | 'views_week', now: Date = new Date()): string {
  return kind === 'views_day' ? kstDaysAgo(1, now) : kstDaysAgo(7, now);
}
