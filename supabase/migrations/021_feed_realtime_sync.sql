-- 021: Sincroniza o repo com o estado real da publicação realtime.
-- (As tabelas de feed já estavam publicadas no banco; garante idempotência.)

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'feed_posts'
  ) then
    ALTER PUBLICATION supabase_realtime ADD TABLE public.feed_posts;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'feed_likes'
  ) then
    ALTER PUBLICATION supabase_realtime ADD TABLE public.feed_likes;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'feed_comments'
  ) then
    ALTER PUBLICATION supabase_realtime ADD TABLE public.feed_comments;
  end if;
end $$;
