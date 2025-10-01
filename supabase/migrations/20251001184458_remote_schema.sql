

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA "pg_catalog";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "public";






CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pg_trgm" WITH SCHEMA "public";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."fn_call_live_poll"("p_stale_min" integer DEFAULT 3) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_url text := 'https://<YOUR_VERCEL_OR_DOMAIN>/api/cron/chzzk-live-poll?staleMin=' || p_stale_min;
  v_resp jsonb;
begin
  select net.http_post(
    url     := v_url,
    headers := jsonb_build_object(
      'content-type','application/json',
      'x-cron-secret', 'supersecret_123'   -- ← 너의 서버에서 쓰는 값으로 바꿔 넣기
    ),
    body    := '{}'::jsonb
  ) into v_resp;

  return coalesce(v_resp, '{}'::jsonb);
end $$;


ALTER FUNCTION "public"."fn_call_live_poll"("p_stale_min" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_today_kst_date"() RETURNS "date"
    LANGUAGE "sql" IMMUTABLE PARALLEL SAFE
    AS $$
  SELECT (now() AT TIME ZONE 'Asia/Seoul')::date;
$$;


ALTER FUNCTION "public"."fn_today_kst_date"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rpc_channels_page"("pivot" "jsonb" DEFAULT NULL::"jsonb", "limit_count" integer DEFAULT 20, "q" "text" DEFAULT NULL::"text", "p_channel_id" "uuid" DEFAULT NULL::"uuid") RETURNS TABLE("channel_id" "uuid", "platform" "text", "platform_channel_id" "text", "title" "text", "thumbnail_url" "text", "is_live_now" boolean, "last_live_ended_at" timestamp with time zone, "recent_published_at" timestamp with time zone, "video_count_120d" integer, "had_live_24h" boolean)
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_pivot_ts timestamptz := CASE WHEN pivot IS NULL THEN NULL ELSE NULLIF(pivot->>'recent_published_at','')::timestamptz END;
  v_pivot_ch uuid        := CASE WHEN pivot IS NULL THEN NULL ELSE NULLIF(pivot->>'channel_id','')::uuid END;
  v_limit int            := LEAST(GREATEST(COALESCE(limit_count,20),1),50);
  kst_today date := (now() at time zone 'Asia/Seoul')::date;
  v_cutoff  timestamptz := ((kst_today - interval '120 days')::timestamp at time zone 'Asia/Seoul');
BEGIN
  RETURN QUERY
  WITH agg AS (
    SELECT v.channel_id,
           MAX(v.published_at) AS recent_published_at,
           COUNT(*)::int       AS video_count_120d
    FROM public.videos_cache v
    WHERE v.published_at >= v_cutoff
    GROUP BY v.channel_id
  ),
  base AS (
    SELECT
      c.id                            AS channel_id,
      c.platform                      AS platform,
      c.platform_channel_id           AS platform_channel_id,
      c.title                         AS title,
      c.thumbnail_url                 AS thumbnail_url,
      c.is_live_now                   AS is_live_now,
      c.last_live_ended_at            AS last_live_ended_at,
      a.recent_published_at           AS recent_published_at,
      COALESCE(a.video_count_120d, 0) AS video_count_120d
    FROM public.channels c
    LEFT JOIN agg a ON a.channel_id = c.id
    WHERE (p_channel_id IS NULL OR c.id = p_channel_id)
      AND (q IS NULL OR (c.title IS NOT NULL AND c.title ILIKE '%'||q||'%'))
  )
  SELECT
    b.channel_id,
    b.platform,
    b.platform_channel_id,
    b.title,
    b.thumbnail_url,
    COALESCE(b.is_live_now, false) AS is_live_now,
    b.last_live_ended_at,
    b.recent_published_at,
    b.video_count_120d,
    (
      COALESCE(b.is_live_now, false)
      OR (
        b.last_live_ended_at IS NOT NULL
        AND b.last_live_ended_at >= ((now() at time zone 'Asia/Seoul') - interval '24 hours')
      )
    ) AS had_live_24h
  FROM base b
  WHERE
    (
      -- 첫 페이지
      (v_pivot_ts IS NULL AND v_pivot_ch IS NULL)
      -- 다음 페이지: (recent_published_at, channel_id) 역정렬 커서
      OR
      (v_pivot_ts IS NOT NULL AND (COALESCE(b.recent_published_at, '-infinity'::timestamptz), b.channel_id) < (v_pivot_ts, v_pivot_ch))
      -- recent_published_at가 NULL인 묶음에서의 타이브레이커
      OR
      (v_pivot_ts IS NULL AND b.recent_published_at IS NULL AND b.channel_id < v_pivot_ch)
    )
  ORDER BY b.recent_published_at DESC NULLS LAST, b.channel_id DESC
  LIMIT v_limit + 1;
END $$;


ALTER FUNCTION "public"."rpc_channels_page"("pivot" "jsonb", "limit_count" integer, "q" "text", "p_channel_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rpc_feed_published_page"("p_channel_ids" "uuid"[], "p_window_start" timestamp with time zone, "p_pivot" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_limit" integer DEFAULT 20, "p_filter_type" "text" DEFAULT 'all'::"text") RETURNS "jsonb"
    LANGUAGE "sql" STABLE
    AS $$
with params as (
  select greatest(1, least(coalesce(p_limit, 20), 50)) as lim
),
cutoff as (
  select ((now() at time zone 'Asia/Seoul')::date - interval '120 days')::timestamp at time zone 'Asia/Seoul' as ts
),
base as (
  select
    v.id,
    v.channel_id,
    v.platform_video_id,
    v.title,
    v.thumbnail_url,
    v.published_at,
    v.duration_sec,
    v.view_count,
    v.like_count,
    v.content_type,
    v.is_live,
    v.chzzk_video_no,
    c.platform,
    c.platform_channel_id,
    c.is_live_now,
    (
      coalesce(c.is_live_now, false)
      or coalesce(c.last_live_ended_at, timestamp '1900-01-01')
         >= ((now() at time zone 'Asia/Seoul') - interval '24 hours')
    ) as had_live_24h
  from public.videos_cache v
  join public.channels c on c.id = v.channel_id
  where v.channel_id = any(p_channel_ids)
    and v.published_at >= (select ts from cutoff)
    and (p_pivot is null or v.published_at < p_pivot)
    and (
      p_filter_type = 'all'
      or (p_filter_type = 'vod'    and v.content_type = 'vod')
      or (p_filter_type in ('video','short') and v.content_type = p_filter_type)
      -- ⚠ live는 제외(라이브 전용 분기에서 처리)
    )
  order by v.published_at desc, v.id desc
  limit (select lim from params) + 1
),
trimmed as (
  select * from base
  order by published_at desc, id desc
  limit (select lim from params)
),
has_more_calc as (
  select (select count(*) from base) > (select count(*) from trimmed) as has_more
),
next_pivot_calc as (
  select (select published_at
          from trimmed
          order by published_at desc, id desc
          offset greatest(0, (select lim from params) - 1)
          limit 1) as next_pivot
)
select jsonb_build_object(
  'rows', coalesce(
            (select jsonb_agg(to_jsonb(t) order by t.published_at desc, t.id desc) from trimmed t),
            '[]'::jsonb
          ),
  'next_pivot', (select next_pivot from next_pivot_calc),
  'has_more',   (select has_more   from has_more_calc)
);
$$;


ALTER FUNCTION "public"."rpc_feed_published_page"("p_channel_ids" "uuid"[], "p_window_start" timestamp with time zone, "p_pivot" timestamp with time zone, "p_limit" integer, "p_filter_type" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rpc_feed_ranking_core"("p_channel_ids" "uuid"[], "p_window_start" timestamp with time zone, "p_baseline_date" "date", "p_limit" integer DEFAULT 20, "p_filter_type" "text" DEFAULT 'all'::"text") RETURNS "jsonb"
    LANGUAGE "sql" STABLE
    AS $$
with params as (
  select greatest(1, least(coalesce(p_limit, 20), 100)) as lim
),
base as (
  select
    v.id,
    v.channel_id,
    v.platform_video_id,
    v.title,
    v.thumbnail_url,
    v.published_at,
    v.duration_sec,
    v.view_count,
    v.like_count,
    v.content_type,
    v.is_live,
    /* ⬇ 추가 */
    v.chzzk_video_no,
    (coalesce(v.view_count, 0) - coalesce(s.view_count, 0)) as delta_views,
    c.platform,
    c.platform_channel_id,
    c.is_live_now,
    ( coalesce(c.is_live_now, false)
      or coalesce(c.last_live_ended_at, timestamp '1900-01-01')
         >= ((now() at time zone 'Asia/Seoul') - interval '24 hours') ) as had_live_24h
  from public.videos_cache v
  join public.channels c on c.id = v.channel_id
  left join public.video_stats_daily s
    on s.video_id = v.id
   and s.stat_date = p_baseline_date
  where v.channel_id = any(p_channel_ids)
    and v.published_at >= (((now() at time zone 'Asia/Seoul')::date - interval '120 days')::timestamp at time zone 'Asia/Seoul')
    and (
      p_filter_type = 'all'
      or (p_filter_type = 'live' and c.platform = 'chzzk' and c.is_live_now = true)
      or (p_filter_type = 'vod'   and v.content_type = 'vod')
      or (p_filter_type in ('video','short') and v.content_type = p_filter_type)
    )
  order by delta_views desc nulls last, v.published_at desc
  limit (select lim from params) + 1
),
trimmed as (
  select * from base
  order by delta_views desc nulls last, published_at desc
  limit (select lim from params)
),
has_more_calc as (
  select (select count(*) from base) > (select count(*) from trimmed) as has_more
)
select jsonb_build_object(
  'rows', coalesce(
            (select jsonb_agg(to_jsonb(t)
                    order by t.delta_views desc nulls last, t.published_at desc) from trimmed t),
            '[]'::jsonb
          ),
  'has_more', (select has_more from has_more_calc)
);
$$;


ALTER FUNCTION "public"."rpc_feed_ranking_core"("p_channel_ids" "uuid"[], "p_window_start" timestamp with time zone, "p_baseline_date" "date", "p_limit" integer, "p_filter_type" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rpc_feed_ranking_day"("p_channel_ids" "uuid"[], "p_window_start" timestamp with time zone, "p_limit" integer DEFAULT 20, "p_filter_type" "text" DEFAULT 'all'::"text") RETURNS "jsonb"
    LANGUAGE "sql" STABLE
    AS $$
select public.rpc_feed_ranking_core(
  p_channel_ids      => p_channel_ids,
  p_window_start     => p_window_start,
  p_baseline_date    => ((now() at time zone 'Asia/Seoul')::date - 1),
  p_limit            => p_limit,
  p_filter_type      => p_filter_type
);
$$;


ALTER FUNCTION "public"."rpc_feed_ranking_day"("p_channel_ids" "uuid"[], "p_window_start" timestamp with time zone, "p_limit" integer, "p_filter_type" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rpc_feed_ranking_day_page"("p_channel_ids" "uuid"[], "p_window_start" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_pivot" "jsonb" DEFAULT NULL::"jsonb", "p_limit" integer DEFAULT 20, "p_filter_type" "text" DEFAULT 'all'::"text") RETURNS "jsonb"
    LANGUAGE "sql" STABLE
    AS $$
SELECT public.rpc_feed_ranking_page_precomp(
  p_channel_ids => p_channel_ids,
  p_table       => 'day',
  p_pivot       => p_pivot,
  p_limit       => p_limit,
  p_filter_type => p_filter_type
);
$$;


ALTER FUNCTION "public"."rpc_feed_ranking_day_page"("p_channel_ids" "uuid"[], "p_window_start" timestamp with time zone, "p_pivot" "jsonb", "p_limit" integer, "p_filter_type" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rpc_feed_ranking_page"("p_channel_ids" "uuid"[], "p_baseline_date" "date", "p_pivot" "jsonb" DEFAULT NULL::"jsonb", "p_limit" integer DEFAULT 20, "p_filter_type" "text" DEFAULT 'all'::"text") RETURNS "jsonb"
    LANGUAGE "sql" STABLE
    AS $$
WITH
params AS (
  SELECT GREATEST(1, LEAST(COALESCE(p_limit,20), 100)) AS lim
),
base AS (
  SELECT
    v.id,
    v.channel_id,
    v.platform_video_id,
    v.title,
    v.thumbnail_url,
    v.published_at,
    v.duration_sec,
    v.view_count,
    v.like_count,
    v.content_type,
    v.is_live,
    c.platform,
    /* Δ조회수 */
    (COALESCE(v.view_count,0) - COALESCE(s.view_count,0))::bigint AS delta_views,
    /* NULLS LAST를 위해 정렬용 ord_delta(널→매우 작은 값) */
    COALESCE((COALESCE(v.view_count,0) - COALESCE(s.view_count,0))::bigint, -9223372036854775807) AS ord_delta
  FROM public.videos_cache v
  JOIN public.channels c ON c.id = v.channel_id
  LEFT JOIN public.video_stats_daily s
    ON s.video_id = v.id
   AND s.stat_date = p_baseline_date
  WHERE v.channel_id = ANY(p_channel_ids)
    AND v.published_at >= (((now() AT TIME ZONE 'Asia/Seoul')::date - interval '120 days')::timestamp AT TIME ZONE 'Asia/Seoul')
    AND (
      p_filter_type = 'all'
      OR (p_filter_type = 'vod'   AND v.content_type = 'vod')
      OR (p_filter_type = 'live'  AND v.is_live = TRUE)
      OR (p_filter_type IN ('video','short') AND v.content_type = p_filter_type)
    )
),
pivot_vals AS (
  SELECT
    CASE WHEN p_pivot IS NULL THEN NULL
         ELSE NULLIF(p_pivot->>'ord_delta','')::bigint
    END AS p_ord_delta,
    CASE WHEN p_pivot IS NULL THEN NULL
         ELSE NULLIF(p_pivot->>'published_at','')::timestamptz
    END AS p_pub,
    CASE WHEN p_pivot IS NULL THEN NULL
         ELSE NULLIF(p_pivot->>'id','')::uuid
    END AS p_vid
),
filtered AS (
  /* 정렬 키: ord_delta DESC, published_at DESC, id DESC
     다음 페이지 조건: (ord_delta, published_at, id) < (pivot)  ← “오름차순 비교”로 다음 블록을 안전히 잡음 */
  SELECT *
  FROM base, pivot_vals
  WHERE
    (p_ord_delta IS NULL AND p_pub IS NULL AND p_vid IS NULL)
    OR ( (ord_delta, published_at, id) < (p_ord_delta, p_pub, p_vid) )
  ORDER BY ord_delta DESC, published_at DESC, id DESC
  LIMIT (SELECT lim FROM params) + 1
),
trimmed AS (
  SELECT * FROM filtered
  ORDER BY ord_delta DESC, published_at DESC, id DESC
  LIMIT (SELECT lim FROM params)
),
has_more_calc AS (
  SELECT (SELECT COUNT(*) FROM filtered) > (SELECT COUNT(*) FROM trimmed) AS has_more
),
last_row AS (
  SELECT ord_delta, published_at, id
  FROM trimmed
  ORDER BY ord_delta DESC, published_at DESC, id DESC
  OFFSET GREATEST(0, (SELECT lim FROM params) - 1)
  LIMIT 1
)
SELECT jsonb_build_object(
  'rows', COALESCE(
    (SELECT jsonb_agg(to_jsonb(t)
      ORDER BY t.ord_delta DESC, t.published_at DESC, t.id DESC)
     FROM trimmed t),
    '[]'::jsonb),
  'has_more', (SELECT has_more FROM has_more_calc),
  'next_pivot',
    COALESCE(
      (SELECT jsonb_build_object(
         'ord_delta', l.ord_delta,
         'published_at', l.published_at,
         'id', l.id
       ) FROM last_row l),
      NULL
    )
);
$$;


ALTER FUNCTION "public"."rpc_feed_ranking_page"("p_channel_ids" "uuid"[], "p_baseline_date" "date", "p_pivot" "jsonb", "p_limit" integer, "p_filter_type" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rpc_feed_ranking_page_precomp"("p_channel_ids" "uuid"[], "p_table" "text", "p_pivot" "jsonb" DEFAULT NULL::"jsonb", "p_limit" integer DEFAULT 20, "p_filter_type" "text" DEFAULT 'all'::"text") RETURNS "jsonb"
    LANGUAGE "sql" STABLE
    AS $$
WITH
params AS (
  SELECT GREATEST(1, LEAST(COALESCE(p_limit,20), 100)) AS lim
),
pivot_vals AS (
  SELECT
    CASE WHEN p_pivot IS NULL THEN NULL ELSE NULLIF(p_pivot->>'ord_delta','')::bigint END AS p_ord_delta,
    CASE WHEN p_pivot IS NULL THEN NULL ELSE NULLIF(p_pivot->>'published_at','')::timestamptz END AS p_pub,
    CASE WHEN p_pivot IS NULL THEN NULL ELSE NULLIF(p_pivot->>'id','')::uuid END AS p_vid
),
rank_src AS (
  SELECT r.*
  FROM (
    SELECT * FROM public.video_rankings_day  WHERE p_table = 'day'
    UNION ALL
    SELECT * FROM public.video_rankings_week WHERE p_table = 'week'
  ) r
  WHERE r.channel_id = ANY(p_channel_ids)
    AND (p_filter_type = 'all' OR r.content_type = p_filter_type)
),
filtered AS (
  SELECT
    v.id,
    v.channel_id,
    v.platform_video_id,
    v.title,
    v.thumbnail_url,
    v.published_at,
    v.duration_sec,
    v.view_count,
    v.like_count,
    v.content_type,
    v.is_live,
    r.ord_delta,
    r.ord_delta AS delta_views
  FROM rank_src r
  JOIN public.videos_cache v ON v.id = r.video_id
  CROSS JOIN pivot_vals
  WHERE
    (p_ord_delta IS NULL AND p_pub IS NULL AND p_vid IS NULL)
    OR ((r.ord_delta, v.published_at, v.id) < (p_ord_delta, p_pub, p_vid))
  ORDER BY r.ord_delta DESC, v.published_at DESC, v.id DESC
  LIMIT (SELECT lim FROM params) + 1
),
trimmed AS (
  SELECT * FROM filtered
  ORDER BY ord_delta DESC, published_at DESC, id DESC
  LIMIT (SELECT lim FROM params)
),
has_more_calc AS (
  SELECT (SELECT COUNT(*) FROM filtered) > (SELECT COUNT(*) FROM trimmed) AS has_more
),
last_row AS (
  SELECT ord_delta, published_at, id
  FROM trimmed
  ORDER BY ord_delta DESC, published_at DESC, id DESC
  OFFSET GREATEST(0, (SELECT lim FROM params) - 1)
  LIMIT 1
)
SELECT jsonb_build_object(
  'rows', COALESCE((SELECT jsonb_agg(to_jsonb(t)
                     ORDER BY t.ord_delta DESC, t.published_at DESC, t.id DESC)
                    FROM trimmed t), '[]'::jsonb),
  'has_more', (SELECT has_more FROM has_more_calc),
  'next_pivot',
  COALESCE((SELECT jsonb_build_object(
              'ord_delta', l.ord_delta,
              'published_at', l.published_at,
              'id', l.id
            ) FROM last_row l), NULL)
);
$$;


ALTER FUNCTION "public"."rpc_feed_ranking_page_precomp"("p_channel_ids" "uuid"[], "p_table" "text", "p_pivot" "jsonb", "p_limit" integer, "p_filter_type" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rpc_feed_ranking_week"("p_channel_ids" "uuid"[], "p_window_start" timestamp with time zone, "p_limit" integer DEFAULT 20, "p_filter_type" "text" DEFAULT 'all'::"text") RETURNS "jsonb"
    LANGUAGE "sql" STABLE
    AS $$
select public.rpc_feed_ranking_core(
  p_channel_ids      => p_channel_ids,
  p_window_start     => p_window_start,
  p_baseline_date    => ((now() at time zone 'Asia/Seoul')::date - 7),
  p_limit            => p_limit,
  p_filter_type      => p_filter_type
);
$$;


ALTER FUNCTION "public"."rpc_feed_ranking_week"("p_channel_ids" "uuid"[], "p_window_start" timestamp with time zone, "p_limit" integer, "p_filter_type" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rpc_feed_ranking_week_page"("p_channel_ids" "uuid"[], "p_window_start" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_pivot" "jsonb" DEFAULT NULL::"jsonb", "p_limit" integer DEFAULT 20, "p_filter_type" "text" DEFAULT 'all'::"text") RETURNS "jsonb"
    LANGUAGE "sql" STABLE
    AS $$
SELECT public.rpc_feed_ranking_page_precomp(
  p_channel_ids => p_channel_ids,
  p_table       => 'week',
  p_pivot       => p_pivot,
  p_limit       => p_limit,
  p_filter_type => p_filter_type
);
$$;


ALTER FUNCTION "public"."rpc_feed_ranking_week_page"("p_channel_ids" "uuid"[], "p_window_start" timestamp with time zone, "p_pivot" "jsonb", "p_limit" integer, "p_filter_type" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rpc_fix_session_close_time"("p_channel_id" "uuid", "p_live_id" bigint, "p_close_time" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
declare
  v_row live_sessions%rowtype;
  v_parsed_close timestamptz;
  v_prev_ended timestamptz;
  v_changed boolean := false;
begin
  if p_close_time is null then
    return jsonb_build_object('success', false, 'reason','no_close_time');
  end if;

  begin
    v_parsed_close := (p_close_time || '+09:00')::timestamptz;
  exception when others then
    return jsonb_build_object('success', false, 'reason','bad_close_time');
  end;

  -- 대상 세션(해당 채널+live_id) 조회
  select * into v_row
    from public.live_sessions
   where channel_id = p_channel_id
     and live_id = p_live_id
   order by started_at desc
   limit 1;

  if not found then
    return jsonb_build_object('success', false, 'reason','session_not_found');
  end if;

  v_prev_ended := v_row.ended_at;

  -- 종료시각이 다르면 교정
  if v_row.ended_at is distinct from v_parsed_close then
     update public.live_sessions
        set ended_at = v_parsed_close,
            updated_at = now(),
            platform_data = coalesce(platform_data,'{}'::jsonb) || jsonb_build_object(
              'ended_at_via','closeDate',
              'ended_at_corrected_from', to_char(v_prev_ended,'YYYY-MM-DD"T"HH24:MI:SSOF')
            )
      where id = v_row.id;
     v_changed := true;
  else
     -- 동일한 시간이더라도 ended_at_via 표시만 정정
     if (platform_data->>'ended_at_via') is distinct from 'closeDate' then
        update public.live_sessions
           set platform_data = coalesce(platform_data,'{}'::jsonb) || jsonb_build_object('ended_at_via','closeDate'),
               updated_at = now()
         where id = v_row.id;
        v_changed := true;
     end if;
  end if;

  -- 마지막 종료시각 메타도 가능하면 함께 보정
  update public.channels c
     set last_live_ended_at = v_parsed_close
   where c.id = p_channel_id
     and (c.last_live_ended_at is distinct from v_parsed_close);

  return jsonb_build_object(
    'success', true,
    'changed', v_changed,
    'session_id', v_row.id,
    'ended_at', v_parsed_close
  );
end;
$$;


ALTER FUNCTION "public"."rpc_fix_session_close_time"("p_channel_id" "uuid", "p_live_id" bigint, "p_close_time" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rpc_purge_videos_older_than_120d"("p_ttl_hours" integer DEFAULT NULL::integer) RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
declare
  d_today date := (now() at time zone 'Asia/Seoul')::date;
  ts_cutoff timestamptz := ((d_today - interval '120 days')::timestamp at time zone 'Asia/Seoul');
  v_deleted int;
begin
  if p_ttl_hours is null then
    delete from public.videos_cache
     where published_at < ts_cutoff;
  else
    delete from public.videos_cache
     where published_at < ts_cutoff
       and cached_at   < now() - make_interval(hours => p_ttl_hours);
  end if;

  get diagnostics v_deleted = row_count;

  return jsonb_build_object(
    'cutoff_kst', ts_cutoff,
    'deleted_count', coalesce(v_deleted,0)
  );
end $$;


ALTER FUNCTION "public"."rpc_purge_videos_older_than_120d"("p_ttl_hours" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rpc_refresh_video_rankings_all"("p_window_days" integer DEFAULT 120) RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_today date := fn_today_kst_date();
  v_upsert_day  integer := 0;
  v_upsert_week integer := 0;
BEGIN
  -- 일간 (baseline = D-1)
  WITH src AS (
    SELECT
      v.id            AS video_id,
      v.channel_id,
      v.published_at,
      v.content_type,
      GREATEST(COALESCE(v.view_count,0) - COALESCE(s.view_count,0), 0)::bigint AS ord_delta
    FROM public.videos_cache v
    LEFT JOIN public.video_stats_daily s
      ON s.video_id = v.id
     AND s.stat_date = v_today - INTERVAL '1 day'
    WHERE v.published_at >= (((v_today)::timestamp AT TIME ZONE 'Asia/Seoul') - (p_window_days || ' days')::interval)
  )
  INSERT INTO public.video_rankings_day AS d (video_id, channel_id, published_at, ord_delta, content_type)
  SELECT video_id, channel_id, published_at, ord_delta, content_type
  FROM src
  ON CONFLICT (video_id) DO UPDATE
  SET channel_id    = EXCLUDED.channel_id,
      published_at  = EXCLUDED.published_at,
      ord_delta     = EXCLUDED.ord_delta,
      content_type  = EXCLUDED.content_type;

  GET DIAGNOSTICS v_upsert_day = ROW_COUNT;

  -- 주간 (baseline = D-7)
  WITH src AS (
    SELECT
      v.id            AS video_id,
      v.channel_id,
      v.published_at,
      v.content_type,
      GREATEST(COALESCE(v.view_count,0) - COALESCE(s.view_count,0), 0)::bigint AS ord_delta
    FROM public.videos_cache v
    LEFT JOIN public.video_stats_daily s
      ON s.video_id = v.id
     AND s.stat_date = v_today - INTERVAL '7 days'
    WHERE v.published_at >= (((v_today)::timestamp AT TIME ZONE 'Asia/Seoul') - (p_window_days || ' days')::interval)
  )
  INSERT INTO public.video_rankings_week AS w (video_id, channel_id, published_at, ord_delta, content_type)
  SELECT video_id, channel_id, published_at, ord_delta, content_type
  FROM src
  ON CONFLICT (video_id) DO UPDATE
  SET channel_id    = EXCLUDED.channel_id,
      published_at  = EXCLUDED.published_at,
      ord_delta     = EXCLUDED.ord_delta,
      content_type  = EXCLUDED.content_type;

  GET DIAGNOSTICS v_upsert_week = ROW_COUNT;

  RETURN json_build_object(
    'upserted_day',  v_upsert_day,
    'upserted_week', v_upsert_week,
    'window_days',   p_window_days,
    'baseline_day',  (v_today - INTERVAL '1 day')::date,
    'baseline_week', (v_today - INTERVAL '7 days')::date
  );
END;
$$;


ALTER FUNCTION "public"."rpc_refresh_video_rankings_all"("p_window_days" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rpc_stats_purge_older_than_30d"() RETURNS "jsonb"
    LANGUAGE "sql"
    AS $$
with cutoff as (
  select ((now() at time zone 'Asia/Seoul')::date - 30) as d
),
deleted as (
  delete from public.video_stats_daily
   where stat_date < (select d from cutoff)
  returning 1
)
select jsonb_build_object(
  'cutoff', (select d from cutoff),
  'deleted_count', coalesce((select count(*) from deleted), 0)
);
$$;


ALTER FUNCTION "public"."rpc_stats_purge_older_than_30d"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rpc_stats_snapshot_today"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  d_today_kst date := (now() at time zone 'Asia/Seoul')::date;
  cutoff_kst  timestamptz := ((d_today_kst - interval '120 days')::timestamp at time zone 'Asia/Seoul');
  v_upserted int;
begin
  -- upsert (video_id, stat_date unique)
  insert into public.video_stats_daily (video_id, stat_date, view_count, like_count, captured_at)
  select v.id, d_today_kst, v.view_count, v.like_count, now()
  from public.videos_cache v
  where v.published_at >= cutoff_kst
  on conflict (video_id, stat_date)
  do update set
    view_count  = excluded.view_count,
    like_count  = excluded.like_count,
    captured_at = now();

  get diagnostics v_upserted = row_count;

  return jsonb_build_object(
    'stat_date', d_today_kst,
    'upserted',  coalesce(v_upserted, 0)
  );
end $$;


ALTER FUNCTION "public"."rpc_stats_snapshot_today"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rpc_update_channel_live_state"("p_channel_id" "uuid", "p_is_live_now" boolean, "p_live_data" "jsonb" DEFAULT NULL::"jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_was_live boolean;
BEGIN
  -- 이전 상태 잠금 + 확인
  SELECT is_live_now INTO v_was_live
  FROM public.channels
  WHERE id = p_channel_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'channel not found: %', p_channel_id;
  END IF;

  UPDATE public.channels SET
    is_live_now = p_is_live_now,
    live_state_updated_at = NOW(),

    -- 현재 라이브 메타 (OPEN일 때만 세팅, CLOSE면 NULL 클리어)
    current_live_id = CASE
      WHEN p_is_live_now THEN NULLIF(p_live_data->>'liveId','')::bigint
      ELSE NULL
    END,
    current_live_title = CASE
      WHEN p_is_live_now THEN p_live_data->>'title'
      ELSE NULL
    END,
    current_live_thumbnail = CASE
      WHEN p_is_live_now THEN p_live_data->>'thumbnail'
      ELSE NULL
    END,
    current_live_viewer_count = CASE
      WHEN p_is_live_now THEN NULLIF(p_live_data->>'concurrentUserCount','')::integer
      ELSE NULL
    END,
    current_live_category = CASE
      WHEN p_is_live_now THEN p_live_data->>'category'
      ELSE NULL
    END,
    current_chat_channel_id = CASE
      WHEN p_is_live_now THEN p_live_data->>'chatChannelId'
      ELSE NULL
    END,

    -- 시작/종료 시각: 치지직 openDate/closeDate (KST 문자열) → UTC 인스턴트로 저장
    last_live_started_at = CASE
      WHEN p_is_live_now = true AND COALESCE(v_was_live, false) = false THEN
        COALESCE( ((p_live_data->>'openDate')::timestamp AT TIME ZONE 'Asia/Seoul'), NOW() )
      ELSE last_live_started_at
    END,
    last_live_ended_at = CASE
      WHEN p_is_live_now = false AND COALESCE(v_was_live, false) = true THEN
        COALESCE( ((p_live_data->>'closeDate')::timestamp AT TIME ZONE 'Asia/Seoul'), NOW() )
      ELSE last_live_ended_at
    END

  WHERE id = p_channel_id;
END;
$$;


ALTER FUNCTION "public"."rpc_update_channel_live_state"("p_channel_id" "uuid", "p_is_live_now" boolean, "p_live_data" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rpc_update_chzzk_live_state"("p_channel_id" "uuid", "p_is_live" boolean, "p_title" "text", "p_thumb" "text", "p_now" timestamp with time zone DEFAULT "now"()) RETURNS "void"
    LANGUAGE "sql" SECURITY DEFINER
    AS $$
  update public.channels c
  set
    -- 이번 상태로 교체
    is_live_now = p_is_live,
    live_state_updated_at = p_now,

    -- 이전(true) → 이번(false) 일 때만 종료시각 기록
    last_live_ended_at = case
      when c.is_live_now = true and p_is_live = false then p_now
      else c.last_live_ended_at
    end,

    -- 메타는 들어온 값이 있을 때만 갱신
    title = coalesce(p_title, c.title),
    thumbnail_url = coalesce(p_thumb, c.thumbnail_url)
  where c.id = p_channel_id;
$$;


ALTER FUNCTION "public"."rpc_update_chzzk_live_state"("p_channel_id" "uuid", "p_is_live" boolean, "p_title" "text", "p_thumb" "text", "p_now" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end $$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."tg_set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at := now();
  return new;
end;
$$;


ALTER FUNCTION "public"."tg_set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."touch_cached_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.cached_at := now();
  return new;
end $$;


ALTER FUNCTION "public"."touch_cached_at"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."channels" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "platform" "text" NOT NULL,
    "platform_channel_id" "text" NOT NULL,
    "title" "text",
    "thumbnail_url" "text",
    "last_synced_at" timestamp with time zone,
    "sync_cooldown_until" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "live_state_updated_at" timestamp with time zone,
    "last_live_ended_at" timestamp with time zone,
    "is_live_now" boolean DEFAULT false NOT NULL,
    "last_live_started_at" timestamp with time zone,
    "uploads_playlist_id" "text",
    "current_live_id" bigint,
    "current_live_title" "text",
    "current_live_thumbnail" "text",
    "current_live_viewer_count" integer,
    "current_live_category" "text",
    "current_chat_channel_id" "text",
    CONSTRAINT "channels_platform_check" CHECK (("platform" = ANY (ARRAY['youtube'::"text", 'chzzk'::"text"])))
);


ALTER TABLE "public"."channels" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."creator_channels" (
    "creator_id" "uuid" NOT NULL,
    "channel_id" "uuid" NOT NULL
);


ALTER TABLE "public"."creator_channels" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."creators" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text",
    "gen" smallint,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "x_url" "text"
);


ALTER TABLE "public"."creators" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."video_rankings_day" (
    "video_id" "uuid" NOT NULL,
    "channel_id" "uuid" NOT NULL,
    "published_at" timestamp with time zone NOT NULL,
    "ord_delta" bigint NOT NULL,
    "content_type" "text" NOT NULL
);


ALTER TABLE "public"."video_rankings_day" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."video_rankings_week" (
    "video_id" "uuid" NOT NULL,
    "channel_id" "uuid" NOT NULL,
    "published_at" timestamp with time zone NOT NULL,
    "ord_delta" bigint NOT NULL,
    "content_type" "text" NOT NULL
);


ALTER TABLE "public"."video_rankings_week" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."video_stats_daily" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "video_id" "uuid" NOT NULL,
    "stat_date" "date" DEFAULT (("now"() AT TIME ZONE 'Asia/Seoul'::"text"))::"date" NOT NULL,
    "view_count" bigint,
    "like_count" bigint,
    "captured_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."video_stats_daily" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."videos_cache" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "channel_id" "uuid" NOT NULL,
    "platform_video_id" "text" NOT NULL,
    "title" "text" NOT NULL,
    "thumbnail_url" "text",
    "published_at" timestamp with time zone NOT NULL,
    "duration_sec" integer,
    "view_count" bigint,
    "like_count" bigint,
    "content_type" "text" NOT NULL,
    "is_live" boolean DEFAULT false NOT NULL,
    "live_started_at" timestamp with time zone,
    "live_ended_at" timestamp with time zone,
    "cached_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "chzzk_video_no" bigint,
    CONSTRAINT "videos_cache_content_type_check" CHECK (("content_type" = ANY (ARRAY['video'::"text", 'short'::"text", 'live'::"text", 'vod'::"text"]))),
    CONSTRAINT "videos_cache_duration_sec_check" CHECK ((("duration_sec" IS NULL) OR ("duration_sec" >= 0)))
);


ALTER TABLE "public"."videos_cache" OWNER TO "postgres";


ALTER TABLE ONLY "public"."channels"
    ADD CONSTRAINT "channels_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."channels"
    ADD CONSTRAINT "channels_platform_platform_channel_id_key" UNIQUE ("platform", "platform_channel_id");



ALTER TABLE ONLY "public"."creator_channels"
    ADD CONSTRAINT "creator_channels_pkey" PRIMARY KEY ("creator_id", "channel_id");



ALTER TABLE ONLY "public"."creators"
    ADD CONSTRAINT "creators_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."video_rankings_day"
    ADD CONSTRAINT "video_rankings_day_pkey" PRIMARY KEY ("video_id");



ALTER TABLE ONLY "public"."video_rankings_week"
    ADD CONSTRAINT "video_rankings_week_pkey" PRIMARY KEY ("video_id");



ALTER TABLE ONLY "public"."video_stats_daily"
    ADD CONSTRAINT "video_stats_daily_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."video_stats_daily"
    ADD CONSTRAINT "video_stats_daily_video_id_stat_date_key" UNIQUE ("video_id", "stat_date");



ALTER TABLE ONLY "public"."videos_cache"
    ADD CONSTRAINT "videos_cache_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."videos_cache"
    ADD CONSTRAINT "videos_cache_platform_video_id_key" UNIQUE ("platform_video_id");



CREATE INDEX "idx_channels__live_state_updated_at" ON "public"."channels" USING "btree" ("live_state_updated_at");



CREATE INDEX "idx_channels__sync_pickup" ON "public"."channels" USING "btree" ("sync_cooldown_until", "last_synced_at");



CREATE INDEX "idx_channels__title_trgm" ON "public"."channels" USING "gin" ("title" "public"."gin_trgm_ops");



CREATE INDEX "idx_channels_current_live_id" ON "public"."channels" USING "btree" ("current_live_id");



CREATE INDEX "idx_channels_live_now_updated" ON "public"."channels" USING "btree" ("is_live_now", "live_state_updated_at" DESC);



CREATE INDEX "idx_video_stats_daily__stat_date_desc" ON "public"."video_stats_daily" USING "btree" ("stat_date" DESC);



CREATE INDEX "idx_videos_cache_chzzk_video_no" ON "public"."videos_cache" USING "btree" ("chzzk_video_no");



CREATE INDEX "ix_creator_channels__creator_id" ON "public"."creator_channels" USING "btree" ("creator_id");



CREATE INDEX "ix_rank_day__ch__ord_pub_id" ON "public"."video_rankings_day" USING "btree" ("channel_id", "ord_delta" DESC, "published_at" DESC, "video_id" DESC);



CREATE INDEX "ix_rank_day__ch_type__ord_pub_id" ON "public"."video_rankings_day" USING "btree" ("channel_id", "content_type", "ord_delta" DESC, "published_at" DESC, "video_id" DESC);



CREATE INDEX "ix_rank_day__ord_pub_id" ON "public"."video_rankings_day" USING "btree" ("ord_delta" DESC, "published_at" DESC, "video_id" DESC);



CREATE INDEX "ix_rank_week__ch__ord_pub_id" ON "public"."video_rankings_week" USING "btree" ("channel_id", "ord_delta" DESC, "published_at" DESC, "video_id" DESC);



CREATE INDEX "ix_rank_week__ch_type__ord_pub_id" ON "public"."video_rankings_week" USING "btree" ("channel_id", "content_type", "ord_delta" DESC, "published_at" DESC, "video_id" DESC);



CREATE INDEX "ix_rank_week__ord_pub_id" ON "public"."video_rankings_week" USING "btree" ("ord_delta" DESC, "published_at" DESC, "video_id" DESC);



CREATE INDEX "ix_videos_cache__channel_published_desc" ON "public"."videos_cache" USING "btree" ("channel_id", "published_at" DESC, "id" DESC) INCLUDE ("title", "thumbnail_url", "duration_sec", "view_count", "like_count", "content_type", "is_live", "platform_video_id", "chzzk_video_no");



CREATE INDEX "ix_videos_cache__channel_type_published_desc" ON "public"."videos_cache" USING "btree" ("channel_id", "content_type", "published_at" DESC, "id" DESC);



CREATE INDEX "ix_videos_cache__id_pub" ON "public"."videos_cache" USING "btree" ("id", "published_at" DESC);



CREATE UNIQUE INDEX "uq_creator_channels__channel_id" ON "public"."creator_channels" USING "btree" ("channel_id");



CREATE UNIQUE INDEX "uq_creators__slug_notnull" ON "public"."creators" USING "btree" ("lower"("slug")) WHERE ("slug" IS NOT NULL);



CREATE OR REPLACE TRIGGER "tg_creators_set_updated" BEFORE UPDATE ON "public"."creators" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_touch_cached_at" BEFORE UPDATE ON "public"."videos_cache" FOR EACH ROW EXECUTE FUNCTION "public"."touch_cached_at"();



ALTER TABLE ONLY "public"."creator_channels"
    ADD CONSTRAINT "creator_channels_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."creator_channels"
    ADD CONSTRAINT "creator_channels_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "public"."creators"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."video_stats_daily"
    ADD CONSTRAINT "video_stats_daily_video_id_fkey" FOREIGN KEY ("video_id") REFERENCES "public"."videos_cache"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."videos_cache"
    ADD CONSTRAINT "videos_cache_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE CASCADE;



ALTER TABLE "public"."channels" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "channels_select_all" ON "public"."channels" FOR SELECT USING (true);



ALTER TABLE "public"."creator_channels" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."creators" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."video_rankings_day" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "video_rankings_day_select_all" ON "public"."video_rankings_day" FOR SELECT USING (true);



ALTER TABLE "public"."video_rankings_week" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "video_rankings_week_select_all" ON "public"."video_rankings_week" FOR SELECT USING (true);



ALTER TABLE "public"."video_stats_daily" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "video_stats_daily_select_all" ON "public"."video_stats_daily" FOR SELECT USING (true);



ALTER TABLE "public"."videos_cache" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "videos_cache_select_all" ON "public"."videos_cache" FOR SELECT USING (true);





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";





GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";






GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "service_role";














































































































































































REVOKE ALL ON FUNCTION "public"."fn_call_live_poll"("p_stale_min" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_call_live_poll"("p_stale_min" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_today_kst_date"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_today_kst_date"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_today_kst_date"() TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."rpc_channels_page"("pivot" "jsonb", "limit_count" integer, "q" "text", "p_channel_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."rpc_channels_page"("pivot" "jsonb", "limit_count" integer, "q" "text", "p_channel_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."rpc_channels_page"("pivot" "jsonb", "limit_count" integer, "q" "text", "p_channel_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."rpc_feed_published_page"("p_channel_ids" "uuid"[], "p_window_start" timestamp with time zone, "p_pivot" timestamp with time zone, "p_limit" integer, "p_filter_type" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."rpc_feed_published_page"("p_channel_ids" "uuid"[], "p_window_start" timestamp with time zone, "p_pivot" timestamp with time zone, "p_limit" integer, "p_filter_type" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."rpc_feed_published_page"("p_channel_ids" "uuid"[], "p_window_start" timestamp with time zone, "p_pivot" timestamp with time zone, "p_limit" integer, "p_filter_type" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."rpc_feed_ranking_core"("p_channel_ids" "uuid"[], "p_window_start" timestamp with time zone, "p_baseline_date" "date", "p_limit" integer, "p_filter_type" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."rpc_feed_ranking_core"("p_channel_ids" "uuid"[], "p_window_start" timestamp with time zone, "p_baseline_date" "date", "p_limit" integer, "p_filter_type" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."rpc_feed_ranking_core"("p_channel_ids" "uuid"[], "p_window_start" timestamp with time zone, "p_baseline_date" "date", "p_limit" integer, "p_filter_type" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."rpc_feed_ranking_day"("p_channel_ids" "uuid"[], "p_window_start" timestamp with time zone, "p_limit" integer, "p_filter_type" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."rpc_feed_ranking_day"("p_channel_ids" "uuid"[], "p_window_start" timestamp with time zone, "p_limit" integer, "p_filter_type" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."rpc_feed_ranking_day"("p_channel_ids" "uuid"[], "p_window_start" timestamp with time zone, "p_limit" integer, "p_filter_type" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."rpc_feed_ranking_day_page"("p_channel_ids" "uuid"[], "p_window_start" timestamp with time zone, "p_pivot" "jsonb", "p_limit" integer, "p_filter_type" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."rpc_feed_ranking_day_page"("p_channel_ids" "uuid"[], "p_window_start" timestamp with time zone, "p_pivot" "jsonb", "p_limit" integer, "p_filter_type" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."rpc_feed_ranking_day_page"("p_channel_ids" "uuid"[], "p_window_start" timestamp with time zone, "p_pivot" "jsonb", "p_limit" integer, "p_filter_type" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."rpc_feed_ranking_page"("p_channel_ids" "uuid"[], "p_baseline_date" "date", "p_pivot" "jsonb", "p_limit" integer, "p_filter_type" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."rpc_feed_ranking_page"("p_channel_ids" "uuid"[], "p_baseline_date" "date", "p_pivot" "jsonb", "p_limit" integer, "p_filter_type" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."rpc_feed_ranking_page"("p_channel_ids" "uuid"[], "p_baseline_date" "date", "p_pivot" "jsonb", "p_limit" integer, "p_filter_type" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."rpc_feed_ranking_page_precomp"("p_channel_ids" "uuid"[], "p_table" "text", "p_pivot" "jsonb", "p_limit" integer, "p_filter_type" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."rpc_feed_ranking_page_precomp"("p_channel_ids" "uuid"[], "p_table" "text", "p_pivot" "jsonb", "p_limit" integer, "p_filter_type" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."rpc_feed_ranking_page_precomp"("p_channel_ids" "uuid"[], "p_table" "text", "p_pivot" "jsonb", "p_limit" integer, "p_filter_type" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."rpc_feed_ranking_week"("p_channel_ids" "uuid"[], "p_window_start" timestamp with time zone, "p_limit" integer, "p_filter_type" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."rpc_feed_ranking_week"("p_channel_ids" "uuid"[], "p_window_start" timestamp with time zone, "p_limit" integer, "p_filter_type" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."rpc_feed_ranking_week"("p_channel_ids" "uuid"[], "p_window_start" timestamp with time zone, "p_limit" integer, "p_filter_type" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."rpc_feed_ranking_week_page"("p_channel_ids" "uuid"[], "p_window_start" timestamp with time zone, "p_pivot" "jsonb", "p_limit" integer, "p_filter_type" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."rpc_feed_ranking_week_page"("p_channel_ids" "uuid"[], "p_window_start" timestamp with time zone, "p_pivot" "jsonb", "p_limit" integer, "p_filter_type" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."rpc_feed_ranking_week_page"("p_channel_ids" "uuid"[], "p_window_start" timestamp with time zone, "p_pivot" "jsonb", "p_limit" integer, "p_filter_type" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."rpc_fix_session_close_time"("p_channel_id" "uuid", "p_live_id" bigint, "p_close_time" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."rpc_fix_session_close_time"("p_channel_id" "uuid", "p_live_id" bigint, "p_close_time" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."rpc_fix_session_close_time"("p_channel_id" "uuid", "p_live_id" bigint, "p_close_time" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."rpc_purge_videos_older_than_120d"("p_ttl_hours" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rpc_purge_videos_older_than_120d"("p_ttl_hours" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."rpc_refresh_video_rankings_all"("p_window_days" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."rpc_refresh_video_rankings_all"("p_window_days" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."rpc_refresh_video_rankings_all"("p_window_days" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."rpc_stats_purge_older_than_30d"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rpc_stats_purge_older_than_30d"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."rpc_stats_snapshot_today"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rpc_stats_snapshot_today"() TO "service_role";



GRANT ALL ON FUNCTION "public"."rpc_update_channel_live_state"("p_channel_id" "uuid", "p_is_live_now" boolean, "p_live_data" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."rpc_update_channel_live_state"("p_channel_id" "uuid", "p_is_live_now" boolean, "p_live_data" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."rpc_update_channel_live_state"("p_channel_id" "uuid", "p_is_live_now" boolean, "p_live_data" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."rpc_update_chzzk_live_state"("p_channel_id" "uuid", "p_is_live" boolean, "p_title" "text", "p_thumb" "text", "p_now" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."rpc_update_chzzk_live_state"("p_channel_id" "uuid", "p_is_live" boolean, "p_title" "text", "p_thumb" "text", "p_now" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."rpc_update_chzzk_live_state"("p_channel_id" "uuid", "p_is_live" boolean, "p_title" "text", "p_thumb" "text", "p_now" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "postgres";
GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "anon";
GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."show_limit"() TO "postgres";
GRANT ALL ON FUNCTION "public"."show_limit"() TO "anon";
GRANT ALL ON FUNCTION "public"."show_limit"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."show_limit"() TO "service_role";



GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."tg_set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."tg_set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."tg_set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."touch_cached_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."touch_cached_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."touch_cached_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "service_role";
























GRANT ALL ON TABLE "public"."channels" TO "anon";
GRANT ALL ON TABLE "public"."channels" TO "authenticated";
GRANT ALL ON TABLE "public"."channels" TO "service_role";



GRANT ALL ON TABLE "public"."creator_channels" TO "anon";
GRANT ALL ON TABLE "public"."creator_channels" TO "authenticated";
GRANT ALL ON TABLE "public"."creator_channels" TO "service_role";



GRANT ALL ON TABLE "public"."creators" TO "anon";
GRANT ALL ON TABLE "public"."creators" TO "authenticated";
GRANT ALL ON TABLE "public"."creators" TO "service_role";



GRANT ALL ON TABLE "public"."video_rankings_day" TO "anon";
GRANT ALL ON TABLE "public"."video_rankings_day" TO "authenticated";
GRANT ALL ON TABLE "public"."video_rankings_day" TO "service_role";



GRANT ALL ON TABLE "public"."video_rankings_week" TO "anon";
GRANT ALL ON TABLE "public"."video_rankings_week" TO "authenticated";
GRANT ALL ON TABLE "public"."video_rankings_week" TO "service_role";



GRANT ALL ON TABLE "public"."video_stats_daily" TO "anon";
GRANT ALL ON TABLE "public"."video_stats_daily" TO "authenticated";
GRANT ALL ON TABLE "public"."video_stats_daily" TO "service_role";



GRANT ALL ON TABLE "public"."videos_cache" TO "anon";
GRANT ALL ON TABLE "public"."videos_cache" TO "authenticated";
GRANT ALL ON TABLE "public"."videos_cache" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";






























-- RESET ALL;

-- CREATE TRIGGER enforce_bucket_name_length_trigger BEFORE INSERT OR UPDATE OF name ON storage.buckets FOR EACH ROW EXECUTE FUNCTION storage.enforce_bucket_name_length();

-- CREATE TRIGGER objects_delete_delete_prefix AFTER DELETE ON storage.objects FOR EACH ROW EXECUTE FUNCTION storage.delete_prefix_hierarchy_trigger();

-- CREATE TRIGGER objects_insert_create_prefix BEFORE INSERT ON storage.objects FOR EACH ROW EXECUTE FUNCTION storage.objects_insert_prefix_trigger();

-- CREATE TRIGGER objects_update_create_prefix BEFORE UPDATE ON storage.objects FOR EACH ROW WHEN (((new.name <> old.name) OR (new.bucket_id <> old.bucket_id))) EXECUTE FUNCTION storage.objects_update_prefix_trigger();

-- CREATE TRIGGER update_objects_updated_at BEFORE UPDATE ON storage.objects FOR EACH ROW EXECUTE FUNCTION storage.update_updated_at_column();

-- CREATE TRIGGER prefixes_create_hierarchy BEFORE INSERT ON storage.prefixes FOR EACH ROW WHEN ((pg_trigger_depth() < 1)) EXECUTE FUNCTION storage.prefixes_insert_trigger();

-- CREATE TRIGGER prefixes_delete_hierarchy AFTER DELETE ON storage.prefixes FOR EACH ROW EXECUTE FUNCTION storage.delete_prefix_hierarchy_trigger();


