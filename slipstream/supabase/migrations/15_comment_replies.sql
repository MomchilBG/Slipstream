-- Lets a comment be a reply to another comment on the same post (one level
-- of nesting - the app only offers "Reply" on top-level comments).
alter table public.comments add column parent_comment_id uuid references public.comments(id) on delete cascade;
create index comments_parent_comment_id_idx on public.comments (parent_comment_id);

-- Guards against a reply pointing at a comment on a different post (which
-- RLS alone wouldn't catch, since the comments insert policy only checks
-- auth.uid()/is_blocked(), not cross-row relationships).
create function public.enforce_comment_parent_same_post()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  parent_post_id uuid;
begin
  if new.parent_comment_id is not null then
    select post_id into parent_post_id from public.comments where id = new.parent_comment_id;
    if parent_post_id is distinct from new.post_id then
      raise exception 'a reply must belong to the same post as its parent comment';
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_enforce_comment_parent_same_post
before insert or update on public.comments
for each row execute function public.enforce_comment_parent_same_post();

revoke execute on function public.enforce_comment_parent_same_post() from public, anon, authenticated;
