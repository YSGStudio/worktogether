-- 20261020000000_harden_function_grants.sql 되돌리기 (Supabase 기본 권한으로 복원)
alter default privileges in schema public grant execute on functions to anon, public;
grant execute on all functions in schema public to anon, authenticated;
revoke execute on function public.ai_usage_today(uuid, uuid) from public, anon;
