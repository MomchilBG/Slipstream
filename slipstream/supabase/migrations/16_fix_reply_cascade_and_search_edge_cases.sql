-- 1. parent_comment_id was ON DELETE CASCADE, so a user deleting their own
-- comment silently destroyed every reply *other people* wrote to it, even
-- though the delete policy only ever checked the deleter's own authorship.
-- Detach (orphan) replies instead of deleting their content.
alter table public.comments drop constraint comments_parent_comment_id_fkey;
alter table public.comments add constraint comments_parent_comment_id_fkey
  foreign key (parent_comment_id) references public.comments(id) on delete set null;

-- 2. The app only ever offers "Reply" on top-level comments (one level of
-- nesting), but nothing enforced that server-side, so a reply-to-a-reply
-- created via a direct API call would increment the comment count while
-- never actually being rendered (the UI only looks up replies keyed by a
-- top-level comment's id). Reject replies whose parent is itself a reply.
create or replace function public.enforce_comment_parent_same_post()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  parent_post_id uuid;
  parent_parent_id uuid;
begin
  if new.parent_comment_id is not null then
    select post_id, parent_comment_id into parent_post_id, parent_parent_id
      from public.comments where id = new.parent_comment_id;

    if parent_post_id is distinct from new.post_id then
      raise exception 'a reply must belong to the same post as its parent comment';
    end if;

    if parent_parent_id is not null then
      raise exception 'replies can only be added to top-level comments';
    end if;
  end if;
  return new;
end;
$$;

-- 3 & 4. search_posts(): a duplicated tag in the query (e.g. "#gravel
-- #gravel") made count(distinct t.name) never reach cardinality(tag_names),
-- silently excluding otherwise-matching posts; and search words were
-- interpolated into an ILIKE pattern unescaped, so a literal % or _ in a
-- search term was treated as a wildcard. Dedupe the tag array and escape
-- wildcard characters (with '\' as the escape character).
create or replace function public.search_posts(
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
  with normalized_tags as (
    select array(select distinct t from unnest(tag_names) t) as names
  )
  select
    p.id, p.title, p.author_id, p.created_at, p.comment_count, p.like_count, p.dislike_count,
    count(*) over() as total_count
  from public.posts p, normalized_tags nt
  where
    (
      cardinality(search_words) = 0
      or not exists (
        select 1 from unnest(search_words) as w
        where p.title not ilike '%' || replace(replace(replace(w, '\', '\\'), '%', '\%'), '_', '\_') || '%' escape '\'
      )
    )
    and (
      cardinality(nt.names) = 0
      or (
        select count(distinct t.name)
        from public.post_tags pt
        join public.tags t on t.id = pt.tag_id
        where pt.post_id = p.id and t.name = any(nt.names)
      ) = cardinality(nt.names)
    )
  order by
    (case when sort_by = 'score' then p.like_count - p.dislike_count else null end) desc nulls last,
    p.created_at desc
  limit page_limit offset page_offset;
$$;
