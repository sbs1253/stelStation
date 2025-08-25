// 불투명 커서: base64url(JSON). 입력 반환 예시 { mode:'cache', pivot:'2025-08-25T12:34:56Z' } → eyJtb2Rl...In0
export function encodeCursor<T>(state: T): string {
  return Buffer.from(JSON.stringify(state), 'utf8').toString('base64url');
}
export function decodeCursor<T>(cursor: string): T | null {
  try {
    return JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as T;
  } catch {
    return null;
  }
}
