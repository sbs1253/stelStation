create or replace function public.rpc_feed_ranking_page_precomp(
  p_channel_ids uuid[],
  p_table text,
  p_pivot jsonb default null::jsonb,
  p_limit integer default 20,
  p_filter_type text default 'all'::text
)
returns jsonb
language sql
stable
as
$function$
with
params as (
  select greatest(1, least(coalesce(p_limit,20), 100)) as lim
),
pivot_vals as (
  select
    case when p_pivot is null then null else nullif(p_pivot->>'ord_delta','')::bigint end as p_ord_delta,
    case when p_pivot is null then null else nullif(p_pivot->>'published_at','')::timestamptz end as p_pub,
    case when p_pivot is null then null else nullif(p_pivot->>'id','')::uuid end as p_vid
),
rank_src as (
  select r.*
  from (
    select * from public.video_rankings_day  where p_table = 'day'
    union all
    select * from public.video_rankings_week where p_table = 'week'
  ) r
  where r.channel_id = any(p_channel_ids)
    and (p_filter_type = 'all' or r.content_type = p_filter_type)
),
filtered as (
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
    c.platform,
    c.platform_channel_id,
    c.is_live_now,
    ( coalesce(c.is_live_now, false)
      or coalesce(c.last_live_ended_at, timestamp '1900-01-01')
         >= ((now() at time zone 'Asia/Seoul') - interval '24 hours') ) as had_live_24h,
    r.ord_delta,
    r.ord_delta as delta_views
  from rank_src r
  join public.videos_cache v on v.id = r.video_id
  join public.channels c on c.id = v.channel_id
  cross join pivot_vals
  where
    (p_ord_delta is null and p_pub is null and p_vid is null)
    or ((r.ord_delta, v.published_at, v.id) < (p_ord_delta, p_pub, p_vid))
  order by r.ord_delta desc, v.published_at desc, v.id desc
  limit (select lim from params) + 1
),
trimmed as (
  select * from filtered
  order by ord_delta desc, published_at desc, id desc
  limit (select lim from params)
),
has_more_calc as (
  select (select count(*) from filtered) > (select count(*) from trimmed) as has_more
),
last_row as (
  select ord_delta, published_at, id
  from trimmed
  order by ord_delta desc, published_at desc, id desc
  offset greatest(0, (select lim from params) - 1)
  limit 1
)
select jsonb_build_object(
  'rows', coalesce((select jsonb_agg(to_jsonb(t)
                     order by t.ord_delta desc, t.published_at desc, t.id desc)
                    from trimmed t), '[]'::jsonb),
  'has_more', (select has_more from has_more_calc),
  'next_pivot',
  coalesce((select jsonb_build_object(
              'ord_delta', l.ord_delta,
              'published_at', l.published_at,
              'id', l.id
            ) from last_row l), null)
);
$function$;
