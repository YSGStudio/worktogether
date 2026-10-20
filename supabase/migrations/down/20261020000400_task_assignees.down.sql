-- 20261020000400 되돌리기: 할 일마다 담당자 1명(가장 먼저 배정된 학생)
-- 주의: 두 번째 이후 담당자는 사라진다. 이후 check_task·on_project_member_removed·on_group_member_left·
-- can_contribute_task·topic_student_activity·tasks_update 정책은 이전 마이그레이션 정의로 다시 만든다.
alter table public.tasks add column assignee_id uuid references public.profiles (id) on delete set null;
update public.tasks t set assignee_id = (
  select ta.student_id from public.task_assignees ta where ta.task_id = t.id order by ta.created_at limit 1
);
create index tasks_assignee_idx on public.tasks (assignee_id);
drop policy tasks_update on public.tasks;
drop trigger tasks_scope_changed on public.tasks;
drop table public.task_assignees;
drop function public.on_task_scope_changed();
drop function public.check_task_assignee();
drop function public.can_edit_task(uuid);
drop function public.is_task_assignee(uuid);
