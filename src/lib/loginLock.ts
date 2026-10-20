import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { computeLockState, type Attempt } from "@/lib/domain/lockout";

export async function studentLockState(studentId: string) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("student_login_attempts")
    .select("kind, created_at")
    .eq("student_id", studentId)
    .gte("created_at", new Date(Date.now() - 24 * 3600_000).toISOString())
    .order("created_at", { ascending: true });
  const attempts: Attempt[] = (data ?? []).map((a) => ({ kind: a.kind as Attempt["kind"], at: new Date(a.created_at) }));
  return computeLockState(attempts, new Date());
}

// 여러 학생의 잠금 상태(교사 학급 화면)
export async function lockedStudentIds(studentIds: string[]): Promise<Set<string>> {
  if (studentIds.length === 0) return new Set();
  const admin = createAdminClient();
  const { data } = await admin
    .from("student_login_attempts")
    .select("student_id, kind, created_at")
    .in("student_id", studentIds)
    .gte("created_at", new Date(Date.now() - 24 * 3600_000).toISOString());
  const by = new Map<string, Attempt[]>();
  for (const a of data ?? []) {
    const list = by.get(a.student_id) ?? [];
    list.push({ kind: a.kind as Attempt["kind"], at: new Date(a.created_at) });
    by.set(a.student_id, list);
  }
  const now = new Date();
  return new Set([...by].filter(([, list]) => computeLockState(list, now).locked).map(([id]) => id));
}
