"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { loadProject } from "@/lib/project";
import { canEditScope } from "@/lib/domain/scope";
import { safeFileName, validateLink, validateTextResult, validateUpload } from "@/lib/domain/upload";
import { friendlyError } from "@/lib/errors";
import { str } from "@/lib/form";
import { withAssignees } from "@/lib/assignees";
import { attachmentPath, BUCKET } from "@/lib/storage";
import type { ActionResult, Task } from "@/lib/types";

function refresh(projectId: string) {
  revalidatePath(`/p/${projectId}`, "layout");
  revalidatePath("/teacher", "layout");
}

async function contributableTask(taskId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("tasks").select("*").eq("id", taskId).maybeSingle();
  if (!data) return null;
  const [task] = await withAssignees(supabase, [data as Task]);
  const ctx = await loadProject(task.project_id);
  const allowed = task.assignee_ids.includes(ctx.me.id) || canEditScope(ctx.scope, task.group_id);
  return allowed ? { task, ctx } : null;
}

export async function uploadAttachment(taskId: string, _prev: unknown, fd: FormData): Promise<ActionResult> {
  const found = await contributableTask(taskId);
  if (!found) return { ok: false, error: "담당자만 결과물을 올릴 수 있어요" };
  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "올릴 파일을 고르세요" };
  const check = validateUpload({ name: file.name, size: file.size, type: file.type });
  if (!check.ok) return { ok: false, error: check.error };

  const { task, ctx } = found;
  const path = attachmentPath({
    topicId: ctx.topic.id,
    projectId: task.project_id,
    groupId: task.group_id,
    taskId: task.id,
    fileId: randomUUID(),
    ext: check.ext,
  });
  const supabase = await createClient();
  const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: check.mime, upsert: false });
  if (upErr) return { ok: false, error: "파일을 올리지 못했어요. 다시 시도해 주세요." };
  const { error } = await supabase.from("task_attachments").insert({
    task_id: task.id,
    kind: check.kind,
    storage_path: path,
    file_name: safeFileName(file.name),
    mime_type: check.mime,
    size_bytes: file.size,
    uploaded_by: ctx.me.id,
  });
  if (error) {
    await supabase.storage.from(BUCKET).remove([path]);
    return { ok: false, error: friendlyError(error) };
  }
  refresh(task.project_id);
  return { ok: true, message: "파일을 올렸어요" };
}

export async function addLink(taskId: string, _prev: unknown, fd: FormData): Promise<ActionResult> {
  const found = await contributableTask(taskId);
  if (!found) return { ok: false, error: "담당자만 결과물을 올릴 수 있어요" };
  const link = validateLink(str(fd, "url"));
  if (!link.ok) return { ok: false, error: link.error };
  const title = str(fd, "title") || new URL(link.url).hostname;
  const supabase = await createClient();
  const { error } = await supabase.from("task_attachments").insert({
    task_id: taskId,
    kind: "link",
    url: link.url,
    file_name: title.slice(0, 200),
    uploaded_by: found.ctx.me.id,
  });
  if (error) return { ok: false, error: friendlyError(error) };
  refresh(found.task.project_id);
  return { ok: true, message: "링크를 올렸어요" };
}

export async function addTextResult(taskId: string, _prev: unknown, fd: FormData): Promise<ActionResult> {
  const found = await contributableTask(taskId);
  if (!found) return { ok: false, error: "담당자만 결과물을 올릴 수 있어요" };
  const text = validateTextResult({ title: str(fd, "title"), body: str(fd, "body") });
  if (!text.ok) return { ok: false, error: text.error };
  const supabase = await createClient();
  const { error } = await supabase.from("task_attachments").insert({
    task_id: taskId,
    kind: "text",
    body: text.body,
    file_name: text.title,
    uploaded_by: found.ctx.me.id,
  });
  if (error) return { ok: false, error: friendlyError(error) };
  refresh(found.task.project_id);
  return { ok: true, message: "글을 올렸어요" };
}

// 올린 사람과 교사만 지운다. DB 행과 Storage 객체를 함께 지운다.
export async function deleteAttachment(attachmentId: string): Promise<ActionResult> {
  await requireUser();
  const supabase = await createClient();
  const { data: att } = await supabase
    .from("task_attachments")
    .select("id, storage_path, tasks(project_id)")
    .eq("id", attachmentId)
    .maybeSingle();
  if (!att) return { ok: false, error: "자료를 찾을 수 없어요" };
  if (att.storage_path) {
    const { data: removed, error: stErr } = await supabase.storage.from(BUCKET).remove([att.storage_path]);
    if (stErr || !removed?.length) return { ok: false, error: "올린 사람이나 선생님만 지울 수 있어요" };
  }
  const { data, error } = await supabase.from("task_attachments").delete().eq("id", attachmentId).select("id");
  if (error || !data?.length) return { ok: false, error: friendlyError(error, "올린 사람이나 선생님만 지울 수 있어요") };
  const projectId = (att.tasks as unknown as { project_id: string } | null)?.project_id;
  if (projectId) refresh(projectId);
  return { ok: true, message: "자료를 지웠어요" };
}
