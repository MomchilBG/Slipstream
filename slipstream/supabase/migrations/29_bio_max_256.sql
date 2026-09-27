-- Tighten the bio length cap from 500 to 256 chars (product call - it's a
-- short blurb, not another post). Safe to validate immediately here since
-- bio (migration 28) had no real traffic yet - no existing row could be
-- between 257 and 500 chars. A future length-tightening migration on a
-- column already in active use should add the constraint `not valid` and
-- follow up with a separate `validate constraint`, so the ALTER TABLE
-- itself doesn't block on scanning/rejecting existing rows.
alter table public.profiles drop constraint profiles_bio_check;
alter table public.profiles add constraint profiles_bio_check check (bio is null or char_length(bio) <= 256);
