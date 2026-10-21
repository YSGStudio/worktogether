-- 20261021000000 되돌리기: 글 결과물을 없앤다
-- 주의: 학생이 남긴 글 결과물(kind = 'text')은 지워진다.
delete from public.task_attachments where kind = 'text';
alter table public.task_attachments drop constraint task_attachments_check;
alter table public.task_attachments add constraint task_attachments_check check (
  (kind = 'link' and storage_path is null and url ~* '^https?://')
  or (kind <> 'link' and storage_path is not null and url is null)
);
alter table public.task_attachments drop constraint task_attachments_kind_check;
alter table public.task_attachments add constraint task_attachments_kind_check check (kind in ('pdf', 'image', 'link'));
alter table public.task_attachments drop column body;
