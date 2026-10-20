-- 모둠 프로젝트 플래너 초기 스키마
-- 되돌리기: supabase/migrations/down/20261019000000_init.down.sql

create extension if not exists pgcrypto;

-- ─────────────────────────────────────────────
-- 테이블
-- ─────────────────────────────────────────────

create table public.classes (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 50),
  -- 영문 대문자·숫자 6자리, 헷갈리는 0/O/1/I 제외
  code text not null unique check (code ~ '^[A-HJ-NP-Z2-9]{6}$'),
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null check (role in ('teacher', 'student')),
  name text not null check (char_length(btrim(name)) between 1 and 30),
  class_id uuid references public.classes (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (class_id, name),
  check ((role = 'teacher' and class_id is null) or (role = 'student' and class_id is not null))
);

create table public.student_login_attempts (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references public.profiles (id) on delete cascade,
  class_code text not null,
  ip_hash text not null,
  -- fail: 실패, success: 성공, unlock: 교사가 잠금 해제
  kind text not null check (kind in ('fail', 'success', 'unlock')),
  created_at timestamptz not null default now()
);
create index student_login_attempts_student_idx on public.student_login_attempts (student_id, created_at desc);
create index student_login_attempts_ip_idx on public.student_login_attempts (ip_hash, created_at desc);

create table public.topics (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete cascade,
  teacher_id uuid not null references auth.users (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 100),
  goal text not null check (char_length(btrim(goal)) between 1 and 1000),
  description text,
  start_date date not null,
  end_date date not null,
  created_at timestamptz not null default now(),
  check (end_date >= start_date)
);

create table public.topic_leaders (
  topic_id uuid not null references public.topics (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  primary key (topic_id, student_id)
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.topics (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 50),
  description text,
  start_date date not null,
  end_date date not null,
  leader_id uuid references public.profiles (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  check (end_date >= start_date)
);
create unique index projects_one_per_leader on public.projects (topic_id, leader_id) where leader_id is not null;

create table public.project_members (
  project_id uuid not null references public.projects (id) on delete cascade,
  topic_id uuid not null references public.topics (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (project_id, student_id),
  unique (topic_id, student_id)
);

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 30),
  leader_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.group_members (
  group_id uuid not null references public.groups (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  primary key (group_id, student_id),
  unique (project_id, student_id)
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  -- null = 전체 방 또는 방 공통 할 일
  group_id uuid references public.groups (id) on delete set null,
  title text not null check (char_length(btrim(title)) between 1 and 100),
  description text,
  start_date date,
  due_date date,
  assignee_id uuid references public.profiles (id) on delete set null,
  status text not null default 'todo' check (status in ('todo', 'doing', 'done')),
  ai_generated boolean not null default false,
  sort_order integer not null default 0,
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (start_date is null or due_date is null or due_date >= start_date)
);
create index tasks_project_idx on public.tasks (project_id, group_id);
create index tasks_assignee_idx on public.tasks (assignee_id);

create table public.task_attachments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  kind text not null check (kind in ('pdf', 'image', 'link')),
  storage_path text unique,
  url text,
  file_name text not null check (char_length(file_name) between 1 and 200),
  mime_type text,
  size_bytes integer check (size_bytes is null or size_bytes between 0 and 10485760),
  uploaded_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  check (
    (kind = 'link' and storage_path is null and url ~* '^https?://')
    or (kind <> 'link' and storage_path is not null and url is null)
  )
);
create index task_attachments_task_idx on public.task_attachments (task_id);

create table public.notices (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  group_id uuid references public.groups (id) on delete set null,
  author_id uuid references public.profiles (id) on delete set null,
  title text not null check (char_length(btrim(title)) between 1 and 100),
  body text not null check (char_length(body) between 1 and 5000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index notices_project_idx on public.notices (project_id, group_id, created_at desc);

create table public.notice_comments (
  id uuid primary key default gen_random_uuid(),
  notice_id uuid not null references public.notices (id) on delete cascade,
  author_id uuid references public.profiles (id) on delete set null,
  body text not null check (char_length(btrim(body)) between 1 and 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index notice_comments_notice_idx on public.notice_comments (notice_id, created_at);

create table public.ai_generation_log (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  group_id uuid references public.groups (id) on delete cascade,
  requested_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index ai_generation_log_scope_idx on public.ai_generation_log (project_id, group_id, created_at desc);

-- ─────────────────────────────────────────────
-- 공통 함수
-- ─────────────────────────────────────────────

create or replace function public.today_kst() returns date
language sql stable set search_path = public as $$
  select (now() at time zone 'Asia/Seoul')::date
$$;

create or replace function public.try_uuid(p text) returns uuid
language plpgsql immutable set search_path = public as $$
begin
  return p::uuid;
exception when others then
  return null;
end;
$$;

-- ─────────────────────────────────────────────
-- 권한 헬퍼 (security definer, search_path 고정)
-- ─────────────────────────────────────────────

create or replace function public.is_teacher() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'teacher')
$$;

create or replace function public.my_class_id() returns uuid
language sql stable security definer set search_path = public as $$
  select class_id from profiles where id = auth.uid() and role = 'student'
$$;

create or replace function public.is_teacher_of_class(p_class uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from classes where id = p_class and teacher_id = auth.uid())
$$;

create or replace function public.is_teacher_of_topic(p_topic uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from topics t join classes c on c.id = t.class_id
    where t.id = p_topic and c.teacher_id = auth.uid()
  )
$$;

create or replace function public.is_teacher_of_project(p_project uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from projects p join topics t on t.id = p.topic_id join classes c on c.id = t.class_id
    where p.id = p_project and c.teacher_id = auth.uid()
  )
$$;

create or replace function public.is_project_member(p_project uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from project_members where project_id = p_project and student_id = auth.uid())
$$;

create or replace function public.is_project_leader(p_project uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from projects where id = p_project and leader_id = auth.uid())
$$;

create or replace function public.is_topic_leader(p_topic uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from topic_leaders where topic_id = p_topic and student_id = auth.uid())
$$;

create or replace function public.my_group_in_project(p_project uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select group_id from group_members where project_id = p_project and student_id = auth.uid()
$$;

create or replace function public.is_group_leader(p_group uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from groups where id = p_group and leader_id = auth.uid())
$$;

-- 보기: 교사 / 방 팀장 / 방 구성원이고 (방 공통이거나 내 모둠)
create or replace function public.can_view_scope(p_project uuid, p_group uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select
    public.is_teacher_of_project(p_project)
    or public.is_project_leader(p_project)
    or (
      public.is_project_member(p_project)
      and (p_group is null or p_group = public.my_group_in_project(p_project))
    )
$$;

-- 쓰기: 교사 / 방 팀장 / 내 모둠의 모둠장
create or replace function public.can_edit_scope(p_project uuid, p_group uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select
    public.is_teacher_of_project(p_project)
    or public.is_project_leader(p_project)
    or (
      p_group is not null
      and p_group = public.my_group_in_project(p_project)
      and public.is_group_leader(p_group)
    )
$$;

create or replace function public.can_view_task(p_task uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select public.can_view_scope(project_id, group_id) from tasks where id = p_task), false)
$$;

-- 결과물 올리기: 담당자 또는 작성 권한자
create or replace function public.can_contribute_task(p_task uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((
    select t.assignee_id = auth.uid() or public.can_edit_scope(t.project_id, t.group_id)
    from tasks t where t.id = p_task
  ), false)
$$;

create or replace function public.can_view_notice(p_notice uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select public.can_view_scope(project_id, group_id) from notices where id = p_notice), false)
$$;

create or replace function public.shares_project_with(p_student uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from project_members a join project_members b on a.project_id = b.project_id
    where a.student_id = auth.uid() and b.student_id = p_student
  )
$$;

-- ─────────────────────────────────────────────
-- 트리거: 가입 시 프로필
-- 교사는 공개 가입(user_metadata.name), 학생은 service role만 설정할 수 있는 app_metadata로 만든다.
-- ─────────────────────────────────────────────

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.raw_app_meta_data ->> 'role' = 'student' then
    insert into profiles (id, role, name, class_id)
    values (
      new.id, 'student',
      new.raw_app_meta_data ->> 'name',
      (new.raw_app_meta_data ->> 'class_id')::uuid
    );
  else
    insert into profiles (id, role, name)
    values (new.id, 'teacher', coalesce(nullif(btrim(new.raw_user_meta_data ->> 'name'), ''), '선생님'));
  end if;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─────────────────────────────────────────────
-- 트리거: 무결성
-- ─────────────────────────────────────────────

-- 팀장은 그 주제 학급의 학생이어야 한다
create or replace function public.check_topic_leader() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1 from profiles p join topics t on t.class_id = p.class_id
    where p.id = new.student_id and t.id = new.topic_id and p.role = 'student'
  ) then
    raise exception '팀장은 이 학급 학생이어야 해요' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger topic_leaders_check before insert or update on public.topic_leaders
  for each row execute function public.check_topic_leader();

-- 팀장에서 빠지면 그 학생이 이끌던 방은 팀장 없음
create or replace function public.on_topic_leader_removed() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update projects set leader_id = null where topic_id = old.topic_id and leader_id = old.student_id;
  return old;
end;
$$;
create trigger topic_leaders_removed after delete on public.topic_leaders
  for each row execute function public.on_topic_leader_removed();

-- 방: 기간 ⊂ 주제 기간, 팀장 ∈ topic_leaders, 교사가 아니면 팀장 변경 금지
create or replace function public.check_project() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  t record;
begin
  select * into t from topics where id = new.topic_id;
  if new.start_date < t.start_date or new.end_date > t.end_date then
    raise exception '방 기간은 주제 기간(% ~ %) 안이어야 해요', t.start_date, t.end_date using errcode = 'P0001';
  end if;
  if new.leader_id is not null and not exists (
    select 1 from topic_leaders where topic_id = new.topic_id and student_id = new.leader_id
  ) then
    raise exception '방 팀장은 이 주제의 팀장 중에서 골라야 해요' using errcode = 'P0001';
  end if;
  if tg_op = 'UPDATE' then
    if new.topic_id <> old.topic_id then
      raise exception '방의 주제는 바꿀 수 없어요' using errcode = 'P0001';
    end if;
    -- 학생(방 팀장)은 팀장을 새로 정하거나 스스로 그만둘 수 없다.
    -- 학급·학생 삭제 cascade로 팀장이 비워지는 경우(new.leader_id is null, 다른 사람)는 허용한다.
    if new.leader_id is distinct from old.leader_id
       and auth.uid() is not null and not public.is_teacher_of_topic(new.topic_id)
       and (new.leader_id is not null or old.leader_id = auth.uid()) then
      raise exception '방 팀장은 선생님만 바꿀 수 있어요' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;
create trigger projects_check before insert or update on public.projects
  for each row execute function public.check_project();

-- 방 팀장은 자동으로 구성원
create or replace function public.add_leader_as_member() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.leader_id is not null and (tg_op = 'INSERT' or new.leader_id is distinct from old.leader_id) then
    if exists (
      select 1 from project_members
      where topic_id = new.topic_id and student_id = new.leader_id and project_id <> new.id
    ) then
      raise exception '이 팀장은 이미 다른 방에 속해 있어요' using errcode = 'P0001';
    end if;
    insert into project_members (project_id, topic_id, student_id)
    values (new.id, new.topic_id, new.leader_id)
    on conflict (project_id, student_id) do nothing;
  end if;
  return new;
end;
$$;
create trigger projects_leader_member after insert or update on public.projects
  for each row execute function public.add_leader_as_member();

-- 방 구성원: topic_id 채우기, 같은 학급 학생인지 확인
create or replace function public.check_project_member() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_topic uuid;
begin
  select topic_id into v_topic from projects where id = new.project_id;
  new.topic_id := v_topic;
  if not exists (
    select 1 from profiles p join topics t on t.class_id = p.class_id
    where p.id = new.student_id and t.id = v_topic and p.role = 'student'
  ) then
    raise exception '이 학급 학생만 방에 넣을 수 있어요' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger project_members_check before insert or update on public.project_members
  for each row execute function public.check_project_member();

-- 방에서 빠지면: 모둠에서 빼고, 담당 해제, 팀장이면 팀장 없음
create or replace function public.on_project_member_removed() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- 방이 지워지는 중이면(cascade) 정리할 것이 없다
  if not exists (select 1 from projects where id = old.project_id) then
    return old;
  end if;
  delete from group_members where project_id = old.project_id and student_id = old.student_id;
  update tasks set assignee_id = null where project_id = old.project_id and assignee_id = old.student_id;
  update projects set leader_id = null where id = old.project_id and leader_id = old.student_id;
  return old;
end;
$$;
create trigger project_members_removed after delete on public.project_members
  for each row execute function public.on_project_member_removed();

-- 모둠장은 그 모둠원이어야 한다
create or replace function public.check_group() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' and new.project_id <> old.project_id then
    raise exception '모둠의 방은 바꿀 수 없어요' using errcode = 'P0001';
  end if;
  if new.leader_id is not null and not exists (
    select 1 from group_members where group_id = new.id and student_id = new.leader_id
  ) then
    raise exception '모둠장은 그 모둠 학생 중에서 골라야 해요' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger groups_check before insert or update on public.groups
  for each row execute function public.check_group();

-- 모둠원: project_id 채우기, 방 구성원인지 확인
create or replace function public.check_group_member() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_project uuid;
begin
  select project_id into v_project from groups where id = new.group_id;
  new.project_id := v_project;
  if not exists (select 1 from project_members where project_id = v_project and student_id = new.student_id) then
    raise exception '방 구성원만 모둠에 넣을 수 있어요' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger group_members_check before insert or update on public.group_members
  for each row execute function public.check_group_member();

-- 모둠을 떠나면(삭제·이동): 이전 모둠 할 일 담당 해제, 모둠장 해제
create or replace function public.on_group_member_left() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' and new.group_id = old.group_id then
    return new;
  end if;
  -- 모둠 자체가 지워지는 중이면(cascade) 할 일은 방 공통이 되고 담당은 그대로 둔다
  if not exists (select 1 from groups where id = old.group_id) then
    return old;
  end if;
  update tasks set assignee_id = null where group_id = old.group_id and assignee_id = old.student_id;
  update groups set leader_id = null where id = old.group_id and leader_id = old.student_id;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;
create trigger group_members_left after delete or update on public.group_members
  for each row execute function public.on_group_member_left();

-- 할 일: 모둠 소속 확인, 기간 ⊂ 방 기간, 담당자 ∈ 작업 공간, 담당자는 상태만 바꿀 수 있음
create or replace function public.check_task() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  p record;
begin
  select * into p from projects where id = new.project_id;
  -- 방이 지워지는 cascade 중 갱신이면 검사하지 않는다
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
  -- 날짜는 새로 넣거나 바꿀 때만 방 기간과 비교한다(상태만 바꿀 때 막히지 않도록)
  if (tg_op = 'INSERT' or new.start_date is distinct from old.start_date or new.due_date is distinct from old.due_date)
     and ((new.start_date is not null and (new.start_date < p.start_date or new.start_date > p.end_date))
       or (new.due_date is not null and (new.due_date < p.start_date or new.due_date > p.end_date))) then
    raise exception '날짜는 방 기간(% ~ %) 안이어야 해요', p.start_date, p.end_date using errcode = 'P0001';
  end if;
  if new.assignee_id is not null then
    if new.group_id is not null then
      if not exists (select 1 from group_members where group_id = new.group_id and student_id = new.assignee_id) then
        raise exception '담당자는 이 모둠 학생이어야 해요' using errcode = 'P0001';
      end if;
    elsif not exists (select 1 from project_members where project_id = new.project_id and student_id = new.assignee_id) then
      raise exception '담당자는 이 방 학생이어야 해요' using errcode = 'P0001';
    end if;
  end if;

  -- 학급 삭제 cascade 중(학급 행이 이미 사라짐)에는 담당 해제를 막지 않는다
  if tg_op = 'UPDATE' and auth.uid() is not null and not public.can_edit_scope(old.project_id, old.group_id)
     and exists (
       select 1 from projects pp join topics t on t.id = pp.topic_id join classes c on c.id = t.class_id
       where pp.id = old.project_id
     ) then
    -- 담당자는 상태만 바꿀 수 있다(상태·수정 기록 외 모든 열 비교)
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
create trigger tasks_check before insert or update on public.tasks
  for each row execute function public.check_task();

create or replace function public.check_notice() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.group_id is not null and not exists (
    select 1 from groups where id = new.group_id and project_id = new.project_id
  ) then
    raise exception '이 방의 모둠이 아니에요' using errcode = 'P0001';
  end if;
  if tg_op = 'UPDATE' then
    if new.project_id <> old.project_id or new.author_id is distinct from old.author_id then
      raise exception '공지의 방과 작성자는 바꿀 수 없어요' using errcode = 'P0001';
    end if;
    new.updated_at := now();
  end if;
  return new;
end;
$$;
create trigger notices_check before insert or update on public.notices
  for each row execute function public.check_notice();

create or replace function public.touch_comment() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.notice_id <> old.notice_id or new.author_id is distinct from old.author_id then
    raise exception '댓글의 공지와 작성자는 바꿀 수 없어요' using errcode = 'P0001';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
create trigger notice_comments_touch before update on public.notice_comments
  for each row execute function public.touch_comment();

-- ─────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────

alter table public.classes enable row level security;
alter table public.profiles enable row level security;
alter table public.student_login_attempts enable row level security;
alter table public.topics enable row level security;
alter table public.topic_leaders enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.tasks enable row level security;
alter table public.task_attachments enable row level security;
alter table public.notices enable row level security;
alter table public.notice_comments enable row level security;
alter table public.ai_generation_log enable row level security;

-- classes: 교사 본인만. 학생은 학급코드를 볼 수 없다.
create policy classes_select on public.classes for select using (teacher_id = auth.uid());
create policy classes_insert on public.classes for insert with check (teacher_id = auth.uid() and public.is_teacher());
create policy classes_update on public.classes for update using (teacher_id = auth.uid()) with check (teacher_id = auth.uid());
create policy classes_delete on public.classes for delete using (teacher_id = auth.uid());

-- profiles: 본인, 교사는 자기 학급 학생, 학생은 같은 방 구성원. 쓰기는 service role만(학생 등록·이름 수정은 서버 코드).
create policy profiles_select on public.profiles for select using (
  id = auth.uid()
  or (class_id is not null and public.is_teacher_of_class(class_id))
  or public.shares_project_with(id)
);
create policy profiles_update_teacher on public.profiles for update
  using (class_id is not null and public.is_teacher_of_class(class_id))
  with check (class_id is not null and public.is_teacher_of_class(class_id) and role = 'student');

-- student_login_attempts: 정책 없음 (service role 전용)

-- topics
create policy topics_select on public.topics for select using (
  public.is_teacher_of_class(class_id) or class_id = public.my_class_id()
);
create policy topics_insert on public.topics for insert with check (public.is_teacher_of_class(class_id) and teacher_id = auth.uid());
create policy topics_update on public.topics for update using (public.is_teacher_of_class(class_id)) with check (public.is_teacher_of_class(class_id));
create policy topics_delete on public.topics for delete using (public.is_teacher_of_class(class_id));

-- topic_leaders
create policy topic_leaders_select on public.topic_leaders for select using (
  public.is_teacher_of_topic(topic_id) or student_id = auth.uid()
);
create policy topic_leaders_insert on public.topic_leaders for insert with check (public.is_teacher_of_topic(topic_id));
create policy topic_leaders_delete on public.topic_leaders for delete using (public.is_teacher_of_topic(topic_id));

-- projects: 교사, 방 구성원. 다른 방 학생은 topic_rooms() 함수로 이름·팀장만 본다.
create policy projects_select on public.projects for select using (
  public.is_teacher_of_project(id) or public.is_project_member(id) or leader_id = auth.uid()
);
create policy projects_insert on public.projects for insert with check (
  public.is_teacher_of_topic(topic_id)
  or (
    public.is_topic_leader(topic_id)
    and leader_id = auth.uid()
    and created_by = auth.uid()
    and not exists (select 1 from project_members pm where pm.topic_id = projects.topic_id and pm.student_id = auth.uid())
  )
);
create policy projects_update on public.projects for update
  using (public.is_teacher_of_project(id) or leader_id = auth.uid())
  with check (public.is_teacher_of_topic(topic_id) or public.is_project_leader(id));
create policy projects_delete on public.projects for delete using (public.is_teacher_of_project(id));

-- project_members / groups / group_members: 쓰기는 교사만
create policy project_members_select on public.project_members for select using (
  public.is_teacher_of_project(project_id) or public.is_project_member(project_id)
);
create policy project_members_insert on public.project_members for insert with check (public.is_teacher_of_project(project_id));
create policy project_members_delete on public.project_members for delete using (public.is_teacher_of_project(project_id));

create policy groups_select on public.groups for select using (
  public.is_teacher_of_project(project_id) or public.is_project_member(project_id)
);
create policy groups_insert on public.groups for insert with check (public.is_teacher_of_project(project_id));
create policy groups_update on public.groups for update using (public.is_teacher_of_project(project_id)) with check (public.is_teacher_of_project(project_id));
create policy groups_delete on public.groups for delete using (public.is_teacher_of_project(project_id));

create policy group_members_select on public.group_members for select using (
  public.is_teacher_of_project(project_id) or public.is_project_member(project_id)
);
create policy group_members_insert on public.group_members for insert with check (
  public.is_teacher_of_project((select g.project_id from public.groups g where g.id = group_id))
);
create policy group_members_update on public.group_members for update
  using (public.is_teacher_of_project(project_id))
  with check (public.is_teacher_of_project((select g.project_id from public.groups g where g.id = group_id)));
create policy group_members_delete on public.group_members for delete using (public.is_teacher_of_project(project_id));

-- tasks
create policy tasks_select on public.tasks for select using (public.can_view_scope(project_id, group_id));
create policy tasks_insert on public.tasks for insert with check (public.can_edit_scope(project_id, group_id));
create policy tasks_update on public.tasks for update
  using (public.can_edit_scope(project_id, group_id) or assignee_id = auth.uid())
  with check (public.can_edit_scope(project_id, group_id) or assignee_id = auth.uid());
create policy tasks_delete on public.tasks for delete using (public.can_edit_scope(project_id, group_id));

-- task_attachments: 공개 범위는 할 일을 따른다
create policy task_attachments_select on public.task_attachments for select using (public.can_view_task(task_id));
create policy task_attachments_insert on public.task_attachments for insert with check (
  uploaded_by = auth.uid() and public.can_contribute_task(task_id)
);
create policy task_attachments_delete on public.task_attachments for delete using (
  (uploaded_by = auth.uid() and public.can_view_task(task_id))
  or public.is_teacher_of_project((select t.project_id from public.tasks t where t.id = task_id))
);

-- notices
create policy notices_select on public.notices for select using (public.can_view_scope(project_id, group_id));
create policy notices_insert on public.notices for insert with check (
  author_id = auth.uid() and public.can_edit_scope(project_id, group_id)
);
create policy notices_update on public.notices for update
  using (public.can_edit_scope(project_id, group_id))
  with check (public.can_edit_scope(project_id, group_id));
create policy notices_delete on public.notices for delete using (public.can_edit_scope(project_id, group_id));

-- notice_comments
create policy notice_comments_select on public.notice_comments for select using (public.can_view_notice(notice_id));
create policy notice_comments_insert on public.notice_comments for insert with check (
  author_id = auth.uid() and public.can_view_notice(notice_id)
);
create policy notice_comments_update on public.notice_comments for update
  using (author_id = auth.uid() and public.can_view_notice(notice_id))
  with check (author_id = auth.uid());
create policy notice_comments_delete on public.notice_comments for delete using (
  (author_id = auth.uid() and public.can_view_notice(notice_id))
  or exists (
    select 1 from public.notices n
    where n.id = notice_id and (public.is_teacher_of_project(n.project_id) or public.is_project_leader(n.project_id))
  )
);

-- ai_generation_log
create policy ai_log_select on public.ai_generation_log for select using (public.can_edit_scope(project_id, group_id));
create policy ai_log_insert on public.ai_generation_log for insert with check (
  requested_by = auth.uid() and public.can_edit_scope(project_id, group_id)
);

-- ─────────────────────────────────────────────
-- 조회 함수
-- ─────────────────────────────────────────────

-- 주제 화면용 방 목록: 다른 방 학생에게는 방 이름과 팀장 이름만
create or replace function public.topic_rooms(p_topic uuid)
returns table (id uuid, name text, leader_id uuid, leader_name text, is_mine boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if not (
    public.is_teacher_of_topic(p_topic)
    or exists (select 1 from topics t where t.id = p_topic and t.class_id = public.my_class_id())
  ) then
    return;
  end if;
  return query
    select p.id, p.name, p.leader_id, pr.name,
      exists (select 1 from project_members pm where pm.project_id = p.id and pm.student_id = auth.uid())
    from projects p left join profiles pr on pr.id = p.leader_id
    where p.topic_id = p_topic
    order by p.created_at;
end;
$$;

-- 학생별 활동 모아보기 (교사 전용, security invoker라 교사 RLS가 그대로 적용된다)
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
      when p.leader_id = pm.student_id then 'leader'
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

-- AI 생성 일일 사용량 (작업 공간별, 한국 날짜 기준)
create or replace function public.ai_usage_today(p_project uuid, p_group uuid) returns integer
language sql stable security definer set search_path = public as $$
  select count(*)::int from ai_generation_log
  where public.can_edit_scope(p_project, p_group)
    and project_id = p_project
    and group_id is not distinct from p_group
    and (created_at at time zone 'Asia/Seoul')::date = public.today_kst()
$$;

revoke execute on function public.ai_usage_today(uuid, uuid) from public, anon;
grant execute on function public.ai_usage_today(uuid, uuid) to authenticated;

-- ─────────────────────────────────────────────
-- Storage: 비공개 버킷 task-files
-- 경로: {topic_id}/{project_id}/{group_id 또는 common}/{task_id}/{uuid}.{ext}
-- ─────────────────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'task-files', 'task-files', false, 10485760,
  array['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- 업로드 경로의 주제·방·모둠이 실제 할 일과 맞는지 확인
create or replace function public.task_path_matches(p_name text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from tasks t join projects p on p.id = t.project_id
    where t.id = public.try_uuid((storage.foldername(p_name))[4])
      and p.topic_id = public.try_uuid((storage.foldername(p_name))[1])
      and p.id = public.try_uuid((storage.foldername(p_name))[2])
      and coalesce(t.group_id::text, 'common') = (storage.foldername(p_name))[3]
  )
$$;

create policy task_files_select on storage.objects for select to authenticated using (
  bucket_id = 'task-files'
  and public.can_view_task(public.try_uuid((storage.foldername(name))[4]))
);
create policy task_files_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'task-files'
  and public.can_contribute_task(public.try_uuid((storage.foldername(name))[4]))
  and public.task_path_matches(name)
);
create policy task_files_delete on storage.objects for delete to authenticated using (
  bucket_id = 'task-files'
  and (
    (owner_id = auth.uid()::text and public.can_view_task(public.try_uuid((storage.foldername(name))[4])))
    or public.is_teacher_of_project((select t.project_id from public.tasks t where t.id = public.try_uuid((storage.foldername(name))[4])))
  )
);
