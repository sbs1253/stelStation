create extension if not exists "pg_net" with schema "public" version '0.14.0';

create extension if not exists "pg_trgm" with schema "public" version '1.6';

create table "public"."channels" (
    "id" uuid not null default gen_random_uuid(),
    "platform" text not null,
    "platform_channel_id" text not null,
    "title" text,
    "thumbnail_url" text,
    "last_synced_at" timestamp with time zone,
    "sync_cooldown_until" timestamp with time zone,
    "created_at" timestamp with time zone not null default now(),
    "live_state_updated_at" timestamp with time zone,
    "last_live_ended_at" timestamp with time zone,
    "is_live_now" boolean not null default false,
    "last_live_started_at" timestamp with time zone,
    "uploads_playlist_id" text,
    "current_live_id" bigint,
    "current_live_title" text,
    "current_live_thumbnail" text,
    "current_live_viewer_count" integer,
    "current_live_category" text,
    "current_chat_channel_id" text
);


alter table "public"."channels" enable row level security;

create table "public"."creator_channels" (
    "creator_id" uuid not null,
    "channel_id" uuid not null
);


alter table "public"."creator_channels" enable row level security;

create table "public"."creators" (
    "id" uuid not null default gen_random_uuid(),
    "name" text not null,
    "slug" text,
    "gen" smallint,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
);


alter table "public"."creators" enable row level security;

create table "public"."video_rankings_day" (
    "video_id" uuid not null,
    "channel_id" uuid not null,
    "published_at" timestamp with time zone not null,
    "ord_delta" bigint not null,
    "content_type" text not null
);


alter table "public"."video_rankings_day" enable row level security;

create table "public"."video_rankings_week" (
    "video_id" uuid not null,
    "channel_id" uuid not null,
    "published_at" timestamp with time zone not null,
    "ord_delta" bigint not null,
    "content_type" text not null
);


alter table "public"."video_rankings_week" enable row level security;

create table "public"."video_stats_daily" (
    "id" uuid not null default gen_random_uuid(),
    "video_id" uuid not null,
    "stat_date" date not null default ((now() AT TIME ZONE 'Asia/Seoul'::text))::date,
    "view_count" bigint,
    "like_count" bigint,
    "captured_at" timestamp with time zone not null default now()
);


alter table "public"."video_stats_daily" enable row level security;

create table "public"."videos_cache" (
    "id" uuid not null default gen_random_uuid(),
    "channel_id" uuid not null,
    "platform_video_id" text not null,
    "title" text not null,
    "thumbnail_url" text,
    "published_at" timestamp with time zone not null,
    "duration_sec" integer,
    "view_count" bigint,
    "like_count" bigint,
    "content_type" text not null,
    "is_live" boolean not null default false,
    "live_started_at" timestamp with time zone,
    "live_ended_at" timestamp with time zone,
    "cached_at" timestamp with time zone not null default now(),
    "chzzk_video_no" bigint
);


alter table "public"."videos_cache" enable row level security;

CREATE UNIQUE INDEX channels_pkey ON public.channels USING btree (id);

CREATE UNIQUE INDEX channels_platform_platform_channel_id_key ON public.channels USING btree (platform, platform_channel_id);

CREATE UNIQUE INDEX creator_channels_pkey ON public.creator_channels USING btree (creator_id, channel_id);

CREATE UNIQUE INDEX creators_pkey ON public.creators USING btree (id);

CREATE INDEX idx_channels__live_state_updated_at ON public.channels USING btree (live_state_updated_at);

CREATE INDEX idx_channels__sync_pickup ON public.channels USING btree (sync_cooldown_until, last_synced_at);

CREATE INDEX idx_channels__title_trgm ON public.channels USING gin (title gin_trgm_ops);

CREATE INDEX idx_channels_current_live_id ON public.channels USING btree (current_live_id);

CREATE INDEX idx_channels_live_now_updated ON public.channels USING btree (is_live_now, live_state_updated_at DESC);

CREATE INDEX idx_video_stats_daily__stat_date_desc ON public.video_stats_daily USING btree (stat_date DESC);

CREATE INDEX idx_videos_cache_chzzk_video_no ON public.videos_cache USING btree (chzzk_video_no);

CREATE INDEX ix_creator_channels__creator_id ON public.creator_channels USING btree (creator_id);

CREATE INDEX ix_rank_day__ch__ord_pub_id ON public.video_rankings_day USING btree (channel_id, ord_delta DESC, published_at DESC, video_id DESC);

CREATE INDEX ix_rank_day__ch_type__ord_pub_id ON public.video_rankings_day USING btree (channel_id, content_type, ord_delta DESC, published_at DESC, video_id DESC);

CREATE INDEX ix_rank_day__ord_pub_id ON public.video_rankings_day USING btree (ord_delta DESC, published_at DESC, video_id DESC);

CREATE INDEX ix_rank_week__ch__ord_pub_id ON public.video_rankings_week USING btree (channel_id, ord_delta DESC, published_at DESC, video_id DESC);

CREATE INDEX ix_rank_week__ch_type__ord_pub_id ON public.video_rankings_week USING btree (channel_id, content_type, ord_delta DESC, published_at DESC, video_id DESC);

CREATE INDEX ix_rank_week__ord_pub_id ON public.video_rankings_week USING btree (ord_delta DESC, published_at DESC, video_id DESC);

CREATE INDEX ix_videos_cache__channel_published_desc ON public.videos_cache USING btree (channel_id, published_at DESC, id DESC) INCLUDE (title, thumbnail_url, duration_sec, view_count, like_count, content_type, is_live, platform_video_id, chzzk_video_no);

CREATE INDEX ix_videos_cache__channel_type_published_desc ON public.videos_cache USING btree (channel_id, content_type, published_at DESC, id DESC);

CREATE INDEX ix_videos_cache__id_pub ON public.videos_cache USING btree (id, published_at DESC);

CREATE UNIQUE INDEX uq_creator_channels__channel_id ON public.creator_channels USING btree (channel_id);

CREATE UNIQUE INDEX uq_creators__slug_notnull ON public.creators USING btree (lower(slug)) WHERE (slug IS NOT NULL);

CREATE UNIQUE INDEX video_rankings_day_pkey ON public.video_rankings_day USING btree (video_id);

CREATE UNIQUE INDEX video_rankings_week_pkey ON public.video_rankings_week USING btree (video_id);

CREATE UNIQUE INDEX video_stats_daily_pkey ON public.video_stats_daily USING btree (id);

CREATE UNIQUE INDEX video_stats_daily_video_id_stat_date_key ON public.video_stats_daily USING btree (video_id, stat_date);

CREATE UNIQUE INDEX videos_cache_pkey ON public.videos_cache USING btree (id);

CREATE UNIQUE INDEX videos_cache_platform_video_id_key ON public.videos_cache USING btree (platform_video_id);

alter table "public"."channels" add constraint "channels_pkey" PRIMARY KEY using index "channels_pkey";

alter table "public"."creator_channels" add constraint "creator_channels_pkey" PRIMARY KEY using index "creator_channels_pkey";

alter table "public"."creators" add constraint "creators_pkey" PRIMARY KEY using index "creators_pkey";

alter table "public"."video_rankings_day" add constraint "video_rankings_day_pkey" PRIMARY KEY using index "video_rankings_day_pkey";

alter table "public"."video_rankings_week" add constraint "video_rankings_week_pkey" PRIMARY KEY using index "video_rankings_week_pkey";

alter table "public"."video_stats_daily" add constraint "video_stats_daily_pkey" PRIMARY KEY using index "video_stats_daily_pkey";

alter table "public"."videos_cache" add constraint "videos_cache_pkey" PRIMARY KEY using index "videos_cache_pkey";

alter table "public"."channels" add constraint "channels_platform_check" CHECK ((platform = ANY (ARRAY['youtube'::text, 'chzzk'::text]))) not valid;

alter table "public"."channels" validate constraint "channels_platform_check";

alter table "public"."channels" add constraint "channels_platform_platform_channel_id_key" UNIQUE using index "channels_platform_platform_channel_id_key";

alter table "public"."creator_channels" add constraint "creator_channels_channel_id_fkey" FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE not valid;

alter table "public"."creator_channels" validate constraint "creator_channels_channel_id_fkey";

alter table "public"."creator_channels" add constraint "creator_channels_creator_id_fkey" FOREIGN KEY (creator_id) REFERENCES creators(id) ON DELETE CASCADE not valid;

alter table "public"."creator_channels" validate constraint "creator_channels_creator_id_fkey";

alter table "public"."video_stats_daily" add constraint "video_stats_daily_video_id_fkey" FOREIGN KEY (video_id) REFERENCES videos_cache(id) ON DELETE CASCADE not valid;

alter table "public"."video_stats_daily" validate constraint "video_stats_daily_video_id_fkey";

alter table "public"."video_stats_daily" add constraint "video_stats_daily_video_id_stat_date_key" UNIQUE using index "video_stats_daily_video_id_stat_date_key";

alter table "public"."videos_cache" add constraint "videos_cache_channel_id_fkey" FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE not valid;

alter table "public"."videos_cache" validate constraint "videos_cache_channel_id_fkey";

alter table "public"."videos_cache" add constraint "videos_cache_content_type_check" CHECK ((content_type = ANY (ARRAY['video'::text, 'short'::text, 'live'::text, 'vod'::text]))) not valid;

alter table "public"."videos_cache" validate constraint "videos_cache_content_type_check";

alter table "public"."videos_cache" add constraint "videos_cache_duration_sec_check" CHECK (((duration_sec IS NULL) OR (duration_sec >= 0))) not valid;

alter table "public"."videos_cache" validate constraint "videos_cache_duration_sec_check";

alter table "public"."videos_cache" add constraint "videos_cache_platform_video_id_key" UNIQUE using index "videos_cache_platform_video_id_key";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.rpc_channels_page(pivot jsonb DEFAULT NULL::jsonb, limit_count integer DEFAULT 20, q text DEFAULT NULL::text, p_channel_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(channel_id uuid, platform text, platform_channel_id text, title text, thumbnail_url text, is_live_now boolean, last_live_ended_at timestamp with time zone, recent_published_at timestamp with time zone, video_count_120d integer, had_live_24h boolean)
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
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
END $function$
;

CREATE OR REPLACE FUNCTION public.rpc_feed_published_page(p_channel_ids uuid[], p_window_start timestamp with time zone, p_pivot timestamp with time zone DEFAULT NULL::timestamp with time zone, p_limit integer DEFAULT 20, p_filter_type text DEFAULT 'all'::text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.rpc_feed_ranking_core(p_channel_ids uuid[], p_window_start timestamp with time zone, p_baseline_date date, p_limit integer DEFAULT 20, p_filter_type text DEFAULT 'all'::text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.rpc_feed_ranking_day(p_channel_ids uuid[], p_window_start timestamp with time zone, p_limit integer DEFAULT 20, p_filter_type text DEFAULT 'all'::text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
AS $function$
select public.rpc_feed_ranking_core(
  p_channel_ids      => p_channel_ids,
  p_window_start     => p_window_start,
  p_baseline_date    => ((now() at time zone 'Asia/Seoul')::date - 1),
  p_limit            => p_limit,
  p_filter_type      => p_filter_type
);
$function$
;

CREATE OR REPLACE FUNCTION public.rpc_feed_ranking_day_page(p_channel_ids uuid[], p_window_start timestamp with time zone DEFAULT NULL::timestamp with time zone, p_pivot jsonb DEFAULT NULL::jsonb, p_limit integer DEFAULT 20, p_filter_type text DEFAULT 'all'::text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
AS $function$
SELECT public.rpc_feed_ranking_page_precomp(
  p_channel_ids => p_channel_ids,
  p_table       => 'day',
  p_pivot       => p_pivot,
  p_limit       => p_limit,
  p_filter_type => p_filter_type
);
$function$
;

CREATE OR REPLACE FUNCTION public.rpc_feed_ranking_page(p_channel_ids uuid[], p_baseline_date date, p_pivot jsonb DEFAULT NULL::jsonb, p_limit integer DEFAULT 20, p_filter_type text DEFAULT 'all'::text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.rpc_feed_ranking_page_precomp(p_channel_ids uuid[], p_table text, p_pivot jsonb DEFAULT NULL::jsonb, p_limit integer DEFAULT 20, p_filter_type text DEFAULT 'all'::text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.rpc_feed_ranking_week(p_channel_ids uuid[], p_window_start timestamp with time zone, p_limit integer DEFAULT 20, p_filter_type text DEFAULT 'all'::text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
AS $function$
select public.rpc_feed_ranking_core(
  p_channel_ids      => p_channel_ids,
  p_window_start     => p_window_start,
  p_baseline_date    => ((now() at time zone 'Asia/Seoul')::date - 7),
  p_limit            => p_limit,
  p_filter_type      => p_filter_type
);
$function$
;

CREATE OR REPLACE FUNCTION public.rpc_feed_ranking_week_page(p_channel_ids uuid[], p_window_start timestamp with time zone DEFAULT NULL::timestamp with time zone, p_pivot jsonb DEFAULT NULL::jsonb, p_limit integer DEFAULT 20, p_filter_type text DEFAULT 'all'::text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
AS $function$
SELECT public.rpc_feed_ranking_page_precomp(
  p_channel_ids => p_channel_ids,
  p_table       => 'week',
  p_pivot       => p_pivot,
  p_limit       => p_limit,
  p_filter_type => p_filter_type
);
$function$
;

CREATE OR REPLACE FUNCTION public.rpc_fix_session_close_time(p_channel_id uuid, p_live_id bigint, p_close_time text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.rpc_update_channel_live_state(p_channel_id uuid, p_is_live_now boolean, p_live_data jsonb DEFAULT NULL::jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.rpc_update_chzzk_live_state(p_channel_id uuid, p_is_live boolean, p_title text, p_thumb text, p_now timestamp with time zone DEFAULT now())
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at = now();
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at := now();
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.touch_cached_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.cached_at := now();
  return new;
end $function$
;

create policy "channels_select_all"
on "public"."channels"
as permissive
for select
to public
using (true);


create policy "video_stats_daily_select_all"
on "public"."video_stats_daily"
as permissive
for select
to public
using (true);


create policy "videos_cache_select_all"
on "public"."videos_cache"
as permissive
for select
to public
using (true);


CREATE TRIGGER tg_creators_set_updated BEFORE UPDATE ON public.creators FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_touch_cached_at BEFORE UPDATE ON public.videos_cache FOR EACH ROW EXECUTE FUNCTION touch_cached_at();


CREATE TRIGGER enforce_bucket_name_length_trigger BEFORE INSERT OR UPDATE OF name ON storage.buckets FOR EACH ROW EXECUTE FUNCTION storage.enforce_bucket_name_length();

CREATE TRIGGER objects_delete_delete_prefix AFTER DELETE ON storage.objects FOR EACH ROW EXECUTE FUNCTION storage.delete_prefix_hierarchy_trigger();

CREATE TRIGGER objects_insert_create_prefix BEFORE INSERT ON storage.objects FOR EACH ROW EXECUTE FUNCTION storage.objects_insert_prefix_trigger();

CREATE TRIGGER objects_update_create_prefix BEFORE UPDATE ON storage.objects FOR EACH ROW WHEN (((new.name <> old.name) OR (new.bucket_id <> old.bucket_id))) EXECUTE FUNCTION storage.objects_update_prefix_trigger();

CREATE TRIGGER update_objects_updated_at BEFORE UPDATE ON storage.objects FOR EACH ROW EXECUTE FUNCTION storage.update_updated_at_column();

CREATE TRIGGER prefixes_create_hierarchy BEFORE INSERT ON storage.prefixes FOR EACH ROW WHEN ((pg_trigger_depth() < 1)) EXECUTE FUNCTION storage.prefixes_insert_trigger();

CREATE TRIGGER prefixes_delete_hierarchy AFTER DELETE ON storage.prefixes FOR EACH ROW EXECUTE FUNCTION storage.delete_prefix_hierarchy_trigger();


