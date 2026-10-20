import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export const BUCKET = "task-files";
export const SIGNED_URL_SECONDS = 3600;

// 경로: {topic_id}/{project_id}/{group_id 또는 common}/{task_id}/{uuid}.{ext}
export function attachmentPath(p: { topicId: string; projectId: string; groupId: string | null; taskId: string; fileId: string; ext: string }) {
  return `${p.topicId}/${p.projectId}/${p.groupId ?? "common"}/${p.taskId}/${p.fileId}.${p.ext}`;
}

// 학급·주제·방을 지울 때: DB 삭제 전에 파일 경로를 모으고, DB 삭제가 성공한 뒤에 파일을 지운다.
export async function projectFilePaths(admin: SupabaseClient, projectIds: string[]): Promise<string[]> {
  if (projectIds.length === 0) return [];
  const { data: rows } = await admin
    .from("task_attachments")
    .select("storage_path, tasks!inner(project_id)")
    .in("tasks.project_id", projectIds)
    .not("storage_path", "is", null);
  return (rows ?? []).map((r) => r.storage_path as string);
}

export async function topicFilePaths(admin: SupabaseClient, topicIds: string[]): Promise<string[]> {
  if (topicIds.length === 0) return [];
  const { data: projects } = await admin.from("projects").select("id").in("topic_id", topicIds);
  return projectFilePaths(admin, (projects ?? []).map((p) => p.id as string));
}

export async function classFilePaths(admin: SupabaseClient, classId: string): Promise<string[]> {
  const { data: topics } = await admin.from("topics").select("id").eq("class_id", classId);
  return topicFilePaths(admin, (topics ?? []).map((t) => t.id as string));
}

export async function removePaths(admin: SupabaseClient, paths: string[]) {
  for (let i = 0; i < paths.length; i += 100) {
    await admin.storage.from(BUCKET).remove(paths.slice(i, i + 100));
  }
}

// 볼 수 있는 첨부의 서명 URL을 사용자 세션으로 만든다(Storage RLS가 다시 확인한다).
export async function signedUrls(supabase: SupabaseClient, paths: string[]): Promise<Record<string, string>> {
  if (paths.length === 0) return {};
  const { data } = await supabase.storage.from(BUCKET).createSignedUrls(paths, SIGNED_URL_SECONDS);
  const out: Record<string, string> = {};
  for (const row of data ?? []) if (row.path && row.signedUrl) out[row.path] = row.signedUrl;
  return out;
}
