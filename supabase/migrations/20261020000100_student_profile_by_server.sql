-- 호스팅 Supabase에서는 auth.users INSERT 시점에 app_metadata가 아직 비어 있어 학생이 교사로 만들어졌다.
-- 학생 계정(<uuid>@student.local)에는 트리거가 프로필을 만들지 않고, 서버(service role)가 학생 프로필을 직접 넣는다.
-- 되돌리기: supabase/migrations/down/20261020000100_student_profile_by_server.down.sql

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.raw_app_meta_data ->> 'role' = 'student' then
    insert into profiles (id, role, name, class_id)
    values (
      new.id, 'student',
      new.raw_app_meta_data ->> 'name',
      (new.raw_app_meta_data ->> 'class_id')::uuid
    )
    on conflict (id) do nothing;
  elsif coalesce(new.email, '') like '%@student.local' then
    -- 학생 계정: 서버가 프로필을 만든다
    null;
  else
    insert into profiles (id, role, name)
    values (new.id, 'teacher', coalesce(nullif(btrim(new.raw_user_meta_data ->> 'name'), ''), '선생님'))
    on conflict (id) do nothing;
  end if;
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from anon, authenticated, public;
