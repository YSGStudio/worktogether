-- 교사가 방을 만들 때 insert ... returning이 막히던 문제:
-- is_teacher_of_project(id)는 같은 문장에서 막 들어간 방 행을 보지 못한다. 주제 기준 교사 확인으로 바꾼다.
-- 되돌리기: supabase/migrations/down/20261020000200_projects_select_teacher_topic.down.sql
alter policy projects_select on public.projects using (
  public.is_teacher_of_topic(topic_id) or public.is_project_member(id) or leader_id = auth.uid()
);
