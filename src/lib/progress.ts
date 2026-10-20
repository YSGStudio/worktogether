import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export type ProjectStats = { total: number; done: number; members: number; groups: number };

export async function projectStats(supabase: SupabaseClient, projectIds: string[]): Promise<Record<string, ProjectStats>> {
  const out: Record<string, ProjectStats> = {};
  for (const id of projectIds) out[id] = { total: 0, done: 0, members: 0, groups: 0 };
  if (projectIds.length === 0) return out;
  const [{ data: tasks }, { data: members }, { data: groups }] = await Promise.all([
    supabase.from("tasks").select("project_id, status").in("project_id", projectIds),
    supabase.from("project_members").select("project_id").in("project_id", projectIds),
    supabase.from("groups").select("project_id").in("project_id", projectIds),
  ]);
  for (const t of tasks ?? []) {
    out[t.project_id].total++;
    if (t.status === "done") out[t.project_id].done++;
  }
  for (const m of members ?? []) out[m.project_id].members++;
  for (const g of groups ?? []) out[g.project_id].groups++;
  return out;
}
