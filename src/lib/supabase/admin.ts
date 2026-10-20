import "server-only";
import { createClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env";

// service role 클라이언트: 학생 등록·PIN 재설정·학생 로그인 조회·잠금 해제에서만 쓴다.
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY 환경 변수가 필요해요");
  return createClient(publicEnv().url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function pinPepper(): string {
  const pepper = process.env.STUDENT_PIN_PEPPER;
  if (!pepper) throw new Error("STUDENT_PIN_PEPPER 환경 변수가 필요해요");
  return pepper;
}
