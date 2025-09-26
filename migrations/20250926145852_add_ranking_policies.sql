create policy "video_rankings_day_select_all"
on "public"."video_rankings_day"
as permissive
for select
to public
using (true);

create policy "video_rankings_week_select_all"
on "public"."video_rankings_week"
as permissive
for select
to public
using (true);
