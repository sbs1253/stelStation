-- 선택: 오늘 KST 헬퍼
CREATE OR REPLACE FUNCTION public.fn_today_kst_date()
RETURNS date
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT (now() AT TIME ZONE 'Asia/Seoul')::date;
$$;

-- 일간+주간 랭킹을 한 번에 생성/업서트
CREATE OR REPLACE FUNCTION public.rpc_refresh_video_rankings_all(p_window_days int DEFAULT 120)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
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
