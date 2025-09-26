do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'video_rankings_day'
      and policyname = 'video_rankings_day_select_all'
  ) then
    create policy "video_rankings_day_select_all"
    on public.video_rankings_day
    as permissive
    for select
    to public
    using (true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'video_rankings_week'
      and policyname = 'video_rankings_week_select_all'
  ) then
    create policy "video_rankings_week_select_all"
    on public.video_rankings_week
    as permissive
    for select
    to public
    using (true);
  end if;
end
$$;
