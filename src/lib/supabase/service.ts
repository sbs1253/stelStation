// 절대 클라이언트 번들에 포함되면 안 되는 서버 전용 클라(쓰기/업서트/크론용)
import { createClient } from '@supabase/supabase-js';

if (typeof window !== 'undefined') {
  throw new Error('supabase service client must not run on the client');
}

export const supabaseService = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // 서버 전용 키 클라이언트 사용 금지!!
);
