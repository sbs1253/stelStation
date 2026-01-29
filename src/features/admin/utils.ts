/** ISO 문자열을 "YYYY.MM.DD" 형식으로 변환 (KST 기준) */
export function formatKstDateString(dateString: string): string {
  const date = new Date(dateString);
  return date
    .toLocaleDateString('ko-KR', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
    .replace(/\./g, '.')
    .replace(/\s/g, '');
}
