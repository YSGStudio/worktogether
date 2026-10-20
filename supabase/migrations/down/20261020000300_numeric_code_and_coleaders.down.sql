-- 20261020000300 되돌리기: 공동 팀장 → 방마다 팀장 1명(가장 먼저 지정된 팀장), 학급코드 규칙 복원
-- 주의: 공동 팀장 중 첫 번째만 남고, 숫자 학급코드는 영문·숫자 코드로 바꿔야 한다.

alter table public.projects add column leader_id uuid references public.profiles (id) on delete set null;
update public.projects p set leader_id = (
  select pl.student_id from public.project_leaders pl where pl.project_id = p.id order by pl.created_at limit 1
);
create unique index projects_one_per_leader on public.projects (topic_id, leader_id) where leader_id is not null;

drop policy projects_select on public.projects;
drop policy projects_insert on public.projects;
drop policy projects_update on public.projects;
drop trigger projects_created on public.projects;
drop function public.on_project_created();
drop function public.topic_rooms(uuid);
drop table public.project_leaders;
drop function public.check_project_leader();
drop function public.add_project_leader_as_member();

-- 이후 원래 함수·정책은 20261019000000_init.sql과 20261020000200의 정의를 다시 실행해 복원한다:
--   is_project_leader, check_project, add_leader_as_member(+ projects_leader_member 트리거),
--   on_topic_leader_removed, on_project_member_removed, topic_rooms, topic_student_activity,
--   projects_select / projects_insert / projects_update 정책
alter table public.classes drop constraint classes_code_check;
alter table public.classes add constraint classes_code_check check (code ~ '^[A-HJ-NP-Z2-9]{6}$') not valid;
