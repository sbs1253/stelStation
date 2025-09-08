// 절대 클라이언트 번들에 포함되면 안 되는 서버 전용 클라(쓰기/업서트/크론용)
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

if (typeof window !== 'undefined') {
  throw new Error('supabase service client must not run on the client');
}

let cachedClient: SupabaseClient | null = null;

function getServiceClient(): SupabaseClient {
  if (cachedClient) return cachedClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // 서버 전용 키 클라이언트 사용 금지!!

  if (!url || !serviceKey) {
    throw new Error('Supabase service env not set (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)');
  }

  cachedClient = createClient(url, serviceKey);
  return cachedClient;
}

// 지연 초기화: 실제 메서드 접근 시에만 클라이언트 생성
export const supabaseService = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    const client = getServiceClient() as unknown as Record<PropertyKey, unknown>;
    return Reflect.get(client, prop, receiver);
  },
}) as SupabaseClient;
