-- security definer 함수 실행 권한 줄이기 (Supabase 보안 점검 0028/0029)
-- 되돌리기: supabase/migrations/down/20261020000000_harden_function_grants.down.sql

-- 로그인하지 않은 사용자(anon)는 어떤 앱 함수도 직접 호출할 필요가 없다
revoke execute on all functions in schema public from anon, public;

-- 트리거 함수는 트리거로만 실행된다(실행 시 EXECUTE 권한을 확인하지 않음)
revoke execute on function
  public.handle_new_user(),
  public.check_topic_leader(),
  public.on_topic_leader_removed(),
  public.check_project(),
  public.add_leader_as_member(),
  public.check_project_member(),
  public.on_project_member_removed(),
  public.check_group(),
  public.check_group_member(),
  public.on_group_member_left(),
  public.check_task(),
  public.check_notice(),
  public.touch_comment()
from authenticated;

-- RLS 정책·Storage 정책이 로그인 사용자 권한으로 평가하는 헬퍼와 앱이 rpc로 부르는 함수는 authenticated에 남긴다
grant execute on function
  public.today_kst(),
  public.try_uuid(text),
  public.is_teacher(),
  public.my_class_id(),
  public.is_teacher_of_class(uuid),
  public.is_teacher_of_topic(uuid),
  public.is_teacher_of_project(uuid),
  public.is_project_member(uuid),
  public.is_project_leader(uuid),
  public.is_topic_leader(uuid),
  public.my_group_in_project(uuid),
  public.is_group_leader(uuid),
  public.can_view_scope(uuid, uuid),
  public.can_edit_scope(uuid, uuid),
  public.can_view_task(uuid),
  public.can_contribute_task(uuid),
  public.can_view_notice(uuid),
  public.shares_project_with(uuid),
  public.task_path_matches(text),
  public.topic_rooms(uuid),
  public.topic_student_activity(uuid),
  public.ai_usage_today(uuid, uuid)
to authenticated;

-- 앞으로 만드는 함수도 기본으로 anon에게 열지 않는다
alter default privileges in schema public revoke execute on functions from anon, public;
