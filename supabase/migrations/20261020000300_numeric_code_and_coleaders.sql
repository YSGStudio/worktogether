-- 1) 학급코드: 새 코드는 숫자 6자리. 이미 나눠 준 기존 코드(영문·숫자)는 그대로 쓸 수 있게 둔다.
-- 2) 한 방에 팀장 여러 명(공동 팀장): projects.leader_id → project_leaders 테이블
-- 되돌리기: supabase/migrations/down/20261020000300_numeric_code_and_coleaders.down.sql

-- ── 1) 학급코드 ──
alter table public.classes drop constraint classes_code_check;
alter table public.classes add constraint classes_code_check
  check (code ~ '^[0-9]{6}$' or code ~ '^[A-HJ-NP-Z2-9]{6}$');

-- ── 2) 공동 팀장 ──
create table public.project_leaders (
  project_id uuid not null references public.projects (id) on delete cascade,
  topic_id uuid not null references public.topics (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (project_id, student_id),
  -- 팀장 한 명은 한 주제에서 방 하나만 이끈다
  unique (topic_id, student_id)
);
alter table public.project_leaders enable row level security;

insert into public.project_leaders (project_id, topic_id, student_id)
select id, topic_id, leader_id from public.projects where leader_id is not null;

-- leader_id를 쓰던 정책·함수·트리거를 먼저 걷어낸다
drop policy projects_select on public.projects;
drop policy projects_insert on public.projects;
drop policy projects_update on public.projects;
drop trigger projects_leader_member on public.projects;
drop function public.add_leader_as_member();
drop function public.topic_rooms(uuid);
alter table public.projects drop column leader_id;

create or replace function public.is_project_leader(p_project uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from project_leaders where project_id = p_project and student_id = auth.uid())
$$;

-- 방: 기간 ⊂ 주제 기간, 주제 변경 금지
create or replace function public.check_project() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  t record;
begin
  select * into t from topics where id = new.topic_id;
  if new.start_date < t.start_date or new.end_date > t.end_date then
    raise exception '방 기간은 주제 기간(% ~ %) 안이어야 해요', t.start_date, t.end_date using errcode = 'P0001';
  end if;
  if tg_op = 'UPDATE' and new.topic_id <> old.topic_id then
    raise exception '방의 주제는 바꿀 수 없어요' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

-- 팀장 학생이 직접 만든 방은 그 학생이 팀장이 된다
create or replace function public.on_project_created() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.created_by is not null
     and exists (select 1 from topic_leaders where topic_id = new.topic_id and student_id = new.created_by)
     and not public.is_teacher_of_topic(new.topic_id) then
    insert into project_leaders (project_id, topic_id, student_id) values (new.id, new.topic_id, new.created_by);
  end if;
  return new;
end;
$$;
create trigger projects_created after insert on public.projects
  for each row execute function public.on_project_created();

-- 방 팀장: 주제 팀장 중에서, 다른 방 소속이 아니어야 한다. topic_id는 방에서 채운다.
create or replace function public.check_project_leader() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  select topic_id into new.topic_id from projects where id = new.project_id;
  if not exists (select 1 from topic_leaders where topic_id = new.topic_id and student_id = new.student_id) then
    raise exception '방 팀장은 이 주제의 팀장 중에서 골라야 해요' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from project_members
    where topic_id = new.topic_id and student_id = new.student_id and project_id <> new.project_id
  ) then
    raise exception '이 팀장은 이미 다른 방에 속해 있어요' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger project_leaders_check before insert or update on public.project_leaders
  for each row execute function public.check_project_leader();

-- 방 팀장은 자동으로 구성원
create or replace function public.add_project_leader_as_member() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into project_members (project_id, topic_id, student_id)
  values (new.project_id, new.topic_id, new.student_id)
  on conflict (project_id, student_id) do nothing;
  return new;
end;
$$;
create trigger project_leaders_member after insert on public.project_leaders
  for each row execute function public.add_project_leader_as_member();

-- 주제 팀장에서 빠지면 그 방의 팀장에서도 빠진다
create or replace function public.on_topic_leader_removed() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  delete from project_leaders where topic_id = old.topic_id and student_id = old.student_id;
  return old;
end;
$$;

-- 방에서 빠지면: 모둠에서 빼고, 담당 해제, 팀장 해제
create or replace function public.on_project_member_removed() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from projects where id = old.project_id) then
    return old;
  end if;
  delete from group_members where project_id = old.project_id and student_id = old.student_id;
  update tasks set assignee_id = null where project_id = old.project_id and assignee_id = old.student_id;
  delete from project_leaders where project_id = old.project_id and student_id = old.student_id;
  return old;
end;
$$;

-- 정책
create policy projects_select on public.projects for select using (
  public.is_teacher_of_topic(topic_id) or public.is_project_member(id)
);
create policy projects_insert on public.projects for insert with check (
  public.is_teacher_of_topic(topic_id)
  or (
    public.is_topic_leader(topic_id)
    and created_by = auth.uid()
    and not exists (select 1 from project_members pm where pm.topic_id = projects.topic_id and pm.student_id = auth.uid())
  )
);
create policy projects_update on public.projects for update
  using (public.is_teacher_of_project(id) or public.is_project_leader(id))
  with check (public.is_teacher_of_topic(topic_id) or public.is_project_leader(id));

create policy project_leaders_select on public.project_leaders for select using (
  public.is_teacher_of_project(project_id) or public.is_project_member(project_id)
);
create policy project_leaders_insert on public.project_leaders for insert with check (public.is_teacher_of_project(project_id));
create policy project_leaders_delete on public.project_leaders for delete using (public.is_teacher_of_project(project_id));

-- 주제 화면용 방 목록: 다른 방 학생에게는 방 이름과 팀장 이름만
create function public.topic_rooms(p_topic uuid)
returns table (id uuid, name text, leader_names text, is_mine boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if not (
    public.is_teacher_of_topic(p_topic)
    or exists (select 1 from topics t where t.id = p_topic and t.class_id = public.my_class_id())
  ) then
    return;
  end if;
  return query
    select p.id, p.name,
      (select string_agg(pr.name, ', ' order by pr.name) from project_leaders pl join profiles pr on pr.id = pl.student_id where pl.project_id = p.id),
      exists (select 1 from project_members pm where pm.project_id = p.id and pm.student_id = auth.uid())
    from projects p
    where p.topic_id = p_topic
    order by p.created_at;
end;
$$;

create or replace function public.topic_student_activity(p_topic uuid)
returns table (
  student_id uuid,
  student_name text,
  project_id uuid,
  project_name text,
  group_id uuid,
  group_name text,
  is_group_room boolean,
  member_role text,
  task_count integer,
  todo_count integer,
  doing_count integer,
  done_count integer,
  overdue_count integer,
  attachment_count integer,
  notice_count integer,
  comment_count integer,
  last_activity_at timestamptz
)
language plpgsql stable security invoker set search_path = public as $$
begin
  if not public.is_teacher_of_topic(p_topic) then
    raise exception '선생님만 볼 수 있어요' using errcode = '42501';
  end if;
  return query
  select
    pm.student_id,
    pr.name,
    p.id,
    p.name,
    gm.group_id,
    g.name,
    exists (select 1 from groups gg where gg.project_id = p.id),
    case
      when exists (select 1 from project_leaders pl where pl.project_id = p.id and pl.student_id = pm.student_id) then 'leader'
      when g.leader_id = pm.student_id then 'group_leader'
      else 'member'
    end,
    (select count(*)::int from tasks t where t.project_id = p.id and t.assignee_id = pm.student_id),
    (select count(*)::int from tasks t where t.project_id = p.id and t.assignee_id = pm.student_id and t.status = 'todo'),
    (select count(*)::int from tasks t where t.project_id = p.id and t.assignee_id = pm.student_id and t.status = 'doing'),
    (select count(*)::int from tasks t where t.project_id = p.id and t.assignee_id = pm.student_id and t.status = 'done'),
    (select count(*)::int from tasks t where t.project_id = p.id and t.assignee_id = pm.student_id
       and t.status <> 'done' and t.due_date < public.today_kst()),
    (select count(*)::int from task_attachments a join tasks t on t.id = a.task_id
       where t.project_id = p.id and a.uploaded_by = pm.student_id),
    (select count(*)::int from notices n where n.project_id = p.id and n.author_id = pm.student_id),
    (select count(*)::int from notice_comments c join notices n on n.id = c.notice_id
       where n.project_id = p.id and c.author_id = pm.student_id),
    (select max(x) from (
       select max(t.updated_at) as x from tasks t where t.project_id = p.id and t.updated_by = pm.student_id
       union all
       select max(a.created_at) from task_attachments a join tasks t on t.id = a.task_id
         where t.project_id = p.id and a.uploaded_by = pm.student_id
       union all
       select max(n.updated_at) from notices n where n.project_id = p.id and n.author_id = pm.student_id
       union all
       select max(c.updated_at) from notice_comments c join notices n on n.id = c.notice_id
         where n.project_id = p.id and c.author_id = pm.student_id
     ) s)
  from project_members pm
  join projects p on p.id = pm.project_id
  join profiles pr on pr.id = pm.student_id
  left join group_members gm on gm.project_id = p.id and gm.student_id = pm.student_id
  left join groups g on g.id = gm.group_id
  where p.topic_id = p_topic
  order by pr.name;
end;
$$;

-- 실행 권한: 트리거 함수는 직접 호출 불가, 조회 함수는 로그인 사용자만
revoke execute on function
  public.on_project_created(),
  public.check_project_leader(),
  public.add_project_leader_as_member()
from anon, authenticated, public;
revoke execute on function public.topic_rooms(uuid) from anon, public;
grant execute on function public.topic_rooms(uuid) to authenticated;
