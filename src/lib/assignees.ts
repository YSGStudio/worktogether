import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Task } from "@/lib/types";

type TaskRow = Omit<Task, "assignee_ids">;

// 할 일 행에 담당자 목록(task_assignees)을 붙인다. 공개 범위는 RLS가 할 일과 같게 거른다.
export async function withAssignees(supabase: SupabaseClient, rows: TaskRow[]): Promise<Task[]> {
  if (rows.length === 0) return [];
  const { data } = await supabase.from("task_assignees").select("task_id, student_id").in("task_id", rows.map((t) => t.id));
  const by: Record<string, string[]> = {};
  for (const r of data ?? []) (by[r.task_id] ??= []).push(r.student_id);
  return rows.map((t) => ({ ...t, assignee_ids: by[t.id] ?? [] }));
}

export function assigneeLabel(task: Pick<Task, "assignee_ids">, names: Record<string, string>): string {
  if (task.assignee_ids.length === 0) return "미배정";
  return task.assignee_ids.map((id) => names[id] ?? "?").join(", ");
}

// 담당자 목록을 원하는 값으로 맞춘다(추가·삭제만 한다)
export async function syncAssignees(supabase: SupabaseClient, taskId: string, wanted: string[], current: string[]) {
  const removed = current.filter((id) => !wanted.includes(id));
  const added = wanted.filter((id) => !current.includes(id));
  if (removed.length) {
    const { error } = await supabase.from("task_assignees").delete().eq("task_id", taskId).in("student_id", removed);
    if (error) return error;
  }
  if (added.length) {
    const { error } = await supabase.from("task_assignees").insert(added.map((student_id) => ({ task_id: taskId, student_id })));
    if (error) return error;
  }
  return null;
}
