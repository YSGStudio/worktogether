-- 할 일 결과물로 글을 남길 수 있게 한다: task_attachments.kind = 'text', 본문은 body
-- file_name은 글 제목으로 쓴다. 공개 범위·올리기·지우기 권한은 기존 첨부 정책을 그대로 따른다.
-- 20261020000400 다음에 적용한다.
-- 되돌리기: supabase/migrations/down/20261021000000_text_results.down.sql

alter table public.task_attachments add column body text check (body is null or char_length(btrim(body)) between 1 and 5000);

alter table public.task_attachments drop constraint task_attachments_kind_check;
alter table public.task_attachments add constraint task_attachments_kind_check
  check (kind in ('pdf', 'image', 'link', 'text'));

alter table public.task_attachments drop constraint task_attachments_check;
alter table public.task_attachments add constraint task_attachments_check check (
  (kind = 'link' and storage_path is null and url ~* '^https?://' and body is null)
  or (kind = 'text' and storage_path is null and url is null and body is not null)
  or (kind in ('pdf', 'image') and storage_path is not null and url is null and body is null)
);
