-- 20261020000100 되돌리기: 처음 마이그레이션의 handle_new_user로 복원
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.raw_app_meta_data ->> 'role' = 'student' then
    insert into profiles (id, role, name, class_id)
    values (new.id, 'student', new.raw_app_meta_data ->> 'name', (new.raw_app_meta_data ->> 'class_id')::uuid);
  else
    insert into profiles (id, role, name)
    values (new.id, 'teacher', coalesce(nullif(btrim(new.raw_user_meta_data ->> 'name'), ''), '선생님'));
  end if;
  return new;
end;
$$;
