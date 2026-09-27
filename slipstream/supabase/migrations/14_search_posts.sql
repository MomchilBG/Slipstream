-- Backs the posts-browsing view: filters by title words (all must match,
-- case-insensitive substring) and/or tag names (post must carry all of
-- them), sorted by recency or net score, paginated via limit/offset.
-- Reads only what's already publicly selectable (posts/tags/post_tags all
-- have "viewable by everyone" policies), so this runs as SECURITY INVOKER
-- (the default) rather than needing elevated privileges.
create function public.search_posts(
  search_words text[] default '{}',
  tag_names text[] default '{}',
  sort_by text default 'recent',
  page_limit int default 20,
  page_offset int default 0
)
returns table (
  id uuid,
  title text,
  author_id uuid,
  created_at timestamptz,
  comment_count integer,
  like_count integer,
  dislike_count integer,
  total_count bigint
)
language sql
stable
set search_path = public
as $$
  select
    p.id, p.title, p.author_id, p.created_at, p.comment_count, p.like_count, p.dislike_count,
    count(*) over() as total_count
  from public.posts p
  where
    (
      cardinality(search_words) = 0
      or not exists (
        select 1 from unnest(search_words) as w
        where p.title not ilike '%' || w || '%'
      )
    )
    and (
      cardinality(tag_names) = 0
      or (
        select count(distinct t.name)
        from public.post_tags pt
        join public.tags t on t.id = pt.tag_id
        where pt.post_id = p.id and t.name = any(tag_names)
      ) = cardinality(tag_names)
    )
  order by
    (case when sort_by = 'score' then p.like_count - p.dislike_count else null end) desc nulls last,
    p.created_at desc
  limit page_limit offset page_offset;
$$;

grant execute on function public.search_posts(text[], text[], text, int, int) to anon, authenticated;
