-- 20261019000000_init.sql 되돌리기
-- 실행: psql "$DATABASE_URL" -f supabase/migrations/down/20261019000000_init.down.sql
-- 주의: 모든 앱 데이터와 task-files 버킷 객체가 지워진다.

drop policy if exists task_files_select on storage.objects;
drop policy if exists task_files_insert on storage.objects;
drop policy if exists task_files_delete on storage.objects;
delete from storage.objects where bucket_id = 'task-files';
delete from storage.buckets where id = 'task-files';

drop trigger if exists on_auth_user_created on auth.users;

drop table if exists public.ai_generation_log cascade;
drop table if exists public.notice_comments cascade;
drop table if exists public.notices cascade;
drop table if exists public.task_attachments cascade;
drop table if exists public.tasks cascade;
drop table if exists public.group_members cascade;
drop table if exists public.groups cascade;
drop table if exists public.project_members cascade;
drop table if exists public.projects cascade;
drop table if exists public.topic_leaders cascade;
drop table if exists public.topics cascade;
drop table if exists public.student_login_attempts cascade;
drop table if exists public.profiles cascade;
drop table if exists public.classes cascade;

drop function if exists public.handle_new_user() cascade;
drop function if exists public.check_topic_leader() cascade;
drop function if exists public.on_topic_leader_removed() cascade;
drop function if exists public.check_project() cascade;
drop function if exists public.add_leader_as_member() cascade;
drop function if exists public.check_project_member() cascade;
drop function if exists public.on_project_member_removed() cascade;
drop function if exists public.check_group() cascade;
drop function if exists public.check_group_member() cascade;
drop function if exists public.on_group_member_left() cascade;
drop function if exists public.check_task() cascade;
drop function if exists public.check_notice() cascade;
drop function if exists public.touch_comment() cascade;
drop function if exists public.topic_rooms(uuid);
drop function if exists public.topic_student_activity(uuid);
drop function if exists public.ai_usage_today(uuid, uuid);
drop function if exists public.task_path_matches(text);
drop function if exists public.can_view_notice(uuid);
drop function if exists public.can_contribute_task(uuid);
drop function if exists public.can_view_task(uuid);
drop function if exists public.can_edit_scope(uuid, uuid);
drop function if exists public.can_view_scope(uuid, uuid);
drop function if exists public.shares_project_with(uuid);
drop function if exists public.is_group_leader(uuid);
drop function if exists public.my_group_in_project(uuid);
drop function if exists public.is_topic_leader(uuid);
drop function if exists public.is_project_leader(uuid);
drop function if exists public.is_project_member(uuid);
drop function if exists public.is_teacher_of_project(uuid);
drop function if exists public.is_teacher_of_topic(uuid);
drop function if exists public.is_teacher_of_class(uuid);
drop function if exists public.my_class_id();
drop function if exists public.is_teacher();
drop function if exists public.try_uuid(text);
drop function if exists public.today_kst();
