-- 할 일 담당자 여러 명: tasks.assignee_id → task_assignees 테이블
-- 한 학생은 여러 할 일을, 한 할 일은 여러 학생을 담당할 수 있다.
-- 20261020000300 다음에 적용한다.
-- 되돌리기: supabase/migrations/down/20261020000400_task_assignees.down.sql

create table public.task_assignees (
  task_id uuid not null references public.tasks (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (task_id, student_id)
);
create index task_assignees_student_idx on public.task_assignees (student_id, project_id);
alter table public.task_assignees enable row level security;

insert into public.task_assignees (task_id, project_id, student_id)
select id, project_id, assignee_id from public.tasks where assignee_id is not null;

-- assignee_id를 쓰던 정책을 먼저 걷어내고 열을 지운다
drop policy tasks_update on public.tasks;
alter table public.tasks drop column assignee_id;

create or replace function public.is_task_assignee(p_task uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from task_assignees where task_id = p_task and student_id = auth.uid())
$$;

create or replace function public.can_contribute_task(p_task uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((
    select public.is_task_assignee(t.id) or public.can_edit_scope(t.project_id, t.group_id)
    from tasks t where t.id = p_task
  ), false)
$$;

create or replace function public.can_edit_task(p_task uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select public.can_edit_scope(project_id, group_id) from tasks where id = p_task), false)
$$;

-- 할 일: 모둠 소속 확인, 기간 ⊂ 방 기간, 담당자는 상태만 바꿀 수 있음
create or replace function public.check_task() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  p record;
begin
  select * into p from projects where id = new.project_id;
  if p.id is null and tg_op = 'UPDATE' then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.project_id <> old.project_id then
    raise exception '할 일의 방은 바꿀 수 없어요' using errcode = 'P0001';
  end if;
  if new.group_id is not null and not exists (
    select 1 from groups where id = new.group_id and project_id = new.project_id
  ) then
    raise exception '이 방의 모둠이 아니에요' using errcode = 'P0001';
  end if;
  if (tg_op = 'INSERT' or new.start_date is distinct from old.start_date or new.due_date is distinct from old.due_date)
     and ((new.start_date is not null and (new.start_date < p.start_date or new.start_date > p.end_date))
       or (new.due_date is not null and (new.due_date < p.start_date or new.due_date > p.end_date))) then
    raise exception '날짜는 방 기간(% ~ %) 안이어야 해요', p.start_date, p.end_date using errcode = 'P0001';
  end if;

  if tg_op = 'UPDATE' and auth.uid() is not null and not public.can_edit_scope(old.project_id, old.group_id)
     and exists (
       select 1 from projects pp join topics t on t.id = pp.topic_id join classes c on c.id = t.class_id
       where pp.id = old.project_id
     ) then
    if (to_jsonb(new) - 'status' - 'updated_at' - 'updated_by')
       is distinct from (to_jsonb(old) - 'status' - 'updated_at' - 'updated_by') then
      raise exception '담당자는 상태만 바꿀 수 있어요' using errcode = 'P0001';
    end if;
  end if;

  if tg_op = 'INSERT' then
    new.created_by := coalesce(new.created_by, auth.uid());
  end if;
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  new.updated_at := now();
  return new;
end;
$$;

-- 할 일 소속(모둠)이 바뀌면 새 작업 공간에 없는 담당자는 뺀다
create or replace function public.on_task_scope_changed() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.group_id is not null and new.group_id is distinct from old.group_id then
    delete from task_assignees ta
    where ta.task_id = new.id
      and not exists (select 1 from group_members gm where gm.group_id = new.group_id and gm.student_id = ta.student_id);
  end if;
  return new;
end;
$$;
create trigger tasks_scope_changed after update of group_id on public.tasks
  for each row execute function public.on_task_scope_changed();

-- 담당자: project_id 채우기, 그 할 일 작업 공간의 구성원이어야 한다
create or replace function public.check_task_assignee() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  t record;
begin
  select * into t from tasks where id = new.task_id;
  new.project_id := t.project_id;
  if t.group_id is not null then
    if not exists (select 1 from group_members where group_id = t.group_id and student_id = new.student_id) then
      raise exception '담당자는 이 모둠 학생이어야 해요' using errcode = 'P0001';
    end if;
  elsif not exists (select 1 from project_members where project_id = t.project_id and student_id = new.student_id) then
    raise exception '담당자는 이 방 학생이어야 해요' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger task_assignees_check before insert or update on public.task_assignees
  for each row execute function public.check_task_assignee();

-- 방에서 빠지면: 모둠에서 빼고, 담당 해제, 팀장 해제
create or replace function public.on_project_member_removed() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from projects where id = old.project_id) then
    return old;
  end if;
  delete from group_members where project_id = old.project_id and student_id = old.student_id;
  delete from task_assignees where project_id = old.project_id and student_id = old.student_id;
  delete from project_leaders where project_id = old.project_id and student_id = old.student_id;
  return old;
end;
$$;

-- 모둠을 떠나면(삭제·이동): 이전 모둠 할 일 담당 해제, 모둠장 해제
create or replace function public.on_group_member_left() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' and new.group_id = old.group_id then
    return new;
  end if;
  if not exists (select 1 from groups where id = old.group_id) then
    return old;
  end if;
  delete from task_assignees ta using tasks t
  where ta.task_id = t.id and t.group_id = old.group_id and ta.student_id = old.student_id;
  update groups set leader_id = null where id = old.group_id and leader_id = old.student_id;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

-- 정책
create policy tasks_update on public.tasks for update
  using (public.can_edit_scope(project_id, group_id) or public.is_task_assignee(id))
  with check (public.can_edit_scope(project_id, group_id) or public.is_task_assignee(id));

create policy task_assignees_select on public.task_assignees for select using (public.can_view_task(task_id));
create policy task_assignees_insert on public.task_assignees for insert with check (public.can_edit_task(task_id));
create policy task_assignees_delete on public.task_assignees for delete using (public.can_edit_task(task_id));

-- 학생별 활동: 담당은 task_assignees 기준
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
    (select count(*)::int from task_assignees ta where ta.project_id = p.id and ta.student_id = pm.student_id),
    (select count(*)::int from task_assignees ta join tasks t on t.id = ta.task_id
       where ta.project_id = p.id and ta.student_id = pm.student_id and t.status = 'todo'),
    (select count(*)::int from task_assignees ta join tasks t on t.id = ta.task_id
       where ta.project_id = p.id and ta.student_id = pm.student_id and t.status = 'doing'),
    (select count(*)::int from task_assignees ta join tasks t on t.id = ta.task_id
       where ta.project_id = p.id and ta.student_id = pm.student_id and t.status = 'done'),
    (select count(*)::int from task_assignees ta join tasks t on t.id = ta.task_id
       where ta.project_id = p.id and ta.student_id = pm.student_id
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

-- 실행 권한
revoke execute on function public.on_task_scope_changed(), public.check_task_assignee() from anon, authenticated, public;
revoke execute on function public.is_task_assignee(uuid), public.can_edit_task(uuid) from anon, public;
grant execute on function public.is_task_assignee(uuid), public.can_edit_task(uuid) to authenticated;
