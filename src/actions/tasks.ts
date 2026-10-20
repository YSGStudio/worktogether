"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { removePaths } from "@/lib/storage";
import { loadProject, workspaceMembers } from "@/lib/project";
import { canEditScope } from "@/lib/domain/scope";
import { validateTaskDates } from "@/lib/domain/dates";
import { aiDraftSchema, AI_MAX_TASKS } from "@/lib/domain/ai";
import { isTaskStatus } from "@/lib/domain/status";
import { friendlyError } from "@/lib/errors";
import { optStr, str, strList } from "@/lib/form";
import { syncAssignees, withAssignees } from "@/lib/assignees";
import type { ActionResult, Task } from "@/lib/types";

function refresh(projectId: string) {
  revalidatePath(`/p/${projectId}`, "layout");
  revalidatePath("/teacher", "layout");
}

type TaskInput = {
  title: string;
  description: string | null;
  start_date: string | null;
  due_date: string | null;
  status: string;
  group_id: string | null;
};

function readAssignees(fd: FormData): string[] {
  return [...new Set(strList(fd, "assignee_ids"))];
}

function readTask(fd: FormData): TaskInput {
  return {
    title: str(fd, "title"),
    description: optStr(fd, "description"),
    start_date: optStr(fd, "start_date"),
    due_date: optStr(fd, "due_date"),
    status: str(fd, "status") || "todo",
    group_id: optStr(fd, "group_id"),
  };
}

async function checkTask(projectId: string, input: TaskInput, assigneeIds: string[]): Promise<string | null> {
  const ctx = await loadProject(projectId);
  if (!input.title) return "할 일 제목을 입력하세요";
  if (input.title.length > 100) return "제목은 100자 이하로 써 주세요";
  if (!isTaskStatus(input.status)) return "상태를 확인하세요";
  if (input.group_id && !ctx.groups.some((g) => g.id === input.group_id)) return "모둠을 확인하세요";
  if (!canEditScope(ctx.scope, input.group_id)) return "이 작업 공간에 할 일을 쓸 권한이 없어요";
  const dates = validateTaskDates(input.start_date, input.due_date, { start: ctx.project.start_date, end: ctx.project.end_date });
  if (dates) return dates;
  const allowed = new Set(workspaceMembers(ctx, input.group_id).map((m) => m.id));
  if (assigneeIds.some((id) => !allowed.has(id))) return "담당자는 이 작업 공간 학생이어야 해요";
  return null;
}

export async function createTask(projectId: string, _prev: unknown, fd: FormData): Promise<ActionResult> {
  const input = readTask(fd);
  const ctx = await loadProject(projectId);
  // 모둠장은 자기 모둠 고정
  if (!ctx.scope.isTeacher && !ctx.scope.isProjectLeader) input.group_id = ctx.scope.myGroupId;
  const assigneeIds = readAssignees(fd);
  const invalid = await checkTask(projectId, input, assigneeIds);
  if (invalid) return { ok: false, error: invalid };
  const supabase = await createClient();
  const { data: created, error } = await supabase
    .from("tasks")
    .insert({ ...input, project_id: projectId, created_by: ctx.me.id })
    .select("id")
    .single();
  if (error || !created) return { ok: false, error: friendlyError(error, "할 일을 쓸 권한이 없어요") };
  const assignError = await syncAssignees(supabase, created.id, assigneeIds, []);
  refresh(projectId);
  if (assignError) return { ok: false, error: `할 일은 추가했지만 담당자를 정하지 못했어요: ${friendlyError(assignError)}` };
  return { ok: true, message: "할 일을 추가했어요" };
}

async function getTask(taskId: string): Promise<Task | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("tasks").select("*").eq("id", taskId).maybeSingle();
  if (!data) return null;
  const [task] = await withAssignees(supabase, [data]);
  return task;
}

export async function updateTask(taskId: string, _prev: unknown, fd: FormData): Promise<ActionResult> {
  const task = await getTask(taskId);
  if (!task) return { ok: false, error: "할 일을 찾을 수 없어요" };
  const ctx = await loadProject(task.project_id);
  if (!canEditScope(ctx.scope, task.group_id)) return { ok: false, error: "이 할 일을 고칠 권한이 없어요" };
  const input = readTask(fd);
  if (!ctx.scope.isTeacher && !ctx.scope.isProjectLeader) input.group_id = task.group_id;
  const assigneeIds = readAssignees(fd);
  const invalid = await checkTask(task.project_id, input, assigneeIds);
  if (invalid) return { ok: false, error: invalid };
  const supabase = await createClient();
  const { data, error } = await supabase.from("tasks").update(input).eq("id", taskId).select("id");
  if (error || !data?.length) return { ok: false, error: friendlyError(error, "권한이 없어요") };
  // 소속이 바뀌면 트리거가 새 작업 공간 밖 담당자를 뺀다. 남은 목록 기준으로 맞춘다.
  const { data: now } = await supabase.from("task_assignees").select("student_id").eq("task_id", taskId);
  const assignError = await syncAssignees(supabase, taskId, assigneeIds, (now ?? []).map((r) => r.student_id as string));
  if (assignError) return { ok: false, error: friendlyError(assignError) };
  refresh(task.project_id);
  return { ok: true, message: "저장했어요" };
}

export async function deleteTask(taskId: string, redirectTo?: string): Promise<ActionResult> {
  const task = await getTask(taskId);
  if (!task) return { ok: false, error: "할 일을 찾을 수 없어요" };
  const supabase = await createClient();
  const { data: files } = await supabase.from("task_attachments").select("storage_path").eq("task_id", taskId).not("storage_path", "is", null);
  const { data, error } = await supabase.from("tasks").delete().eq("id", taskId).select("id");
  if (error || !data?.length) return { ok: false, error: friendlyError(error, "권한이 없어요") };
  const paths = (files ?? []).map((f) => f.storage_path as string);
  // 삭제 권한은 RLS로 확인됐다. 다른 사람이 올린 파일도 남지 않게 service role로 정리한다.
  if (paths.length) await removePaths(createAdminClient(), paths);
  refresh(task.project_id);
  if (redirectTo?.startsWith("/") && !redirectTo.startsWith("//")) redirect(redirectTo);
  return { ok: true, message: "할 일을 지웠어요" };
}

// 상태 변경: 담당자 또는 작성 권한자. DB 트리거가 담당자는 상태만 바꾸도록 다시 막는다.
export async function updateTaskStatus(taskId: string, status: string): Promise<ActionResult> {
  if (!isTaskStatus(status)) return { ok: false, error: "상태를 확인하세요" };
  const task = await getTask(taskId);
  if (!task) return { ok: false, error: "할 일을 찾을 수 없어요" };
  const ctx = await loadProject(task.project_id);
  if (!task.assignee_ids.includes(ctx.me.id) && !canEditScope(ctx.scope, task.group_id)) {
    return { ok: false, error: "담당자만 상태를 바꿀 수 있어요" };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.from("tasks").update({ status }).eq("id", taskId).select("id");
  if (error || !data?.length) return { ok: false, error: friendlyError(error, "권한이 없어요") };
  refresh(task.project_id);
  return { ok: true };
}

const draftsSchema = z.array(aiDraftSchema).min(1).max(AI_MAX_TASKS);

// AI 초안 중 고른 것만 저장(ai_generated = true)
export async function saveAiDrafts(projectId: string, groupId: string | null, drafts: unknown): Promise<ActionResult> {
  const parsed = draftsSchema.safeParse(drafts);
  if (!parsed.success) return { ok: false, error: "할 일 내용을 확인하세요 (제목과 날짜가 필요해요)" };
  const ctx = await loadProject(projectId);
  if (groupId && !ctx.groups.some((g) => g.id === groupId)) return { ok: false, error: "모둠을 확인하세요" };
  if (!canEditScope(ctx.scope, groupId)) return { ok: false, error: "이 작업 공간에 할 일을 쓸 권한이 없어요" };
  for (const d of parsed.data) {
    const err = validateTaskDates(d.start_date, d.due_date, { start: ctx.project.start_date, end: ctx.project.end_date });
    if (err) return { ok: false, error: `"${d.title}": ${err}` };
  }
  const supabase = await createClient();
  const { count } = await supabase.from("tasks").select("id", { count: "exact", head: true }).eq("project_id", projectId);
  const rows = parsed.data.map((d, i) => ({
    project_id: projectId,
    group_id: groupId,
    title: d.title,
    description: d.description || null,
    start_date: d.start_date,
    due_date: d.due_date,
    ai_generated: true,
    sort_order: (count ?? 0) + i,
    created_by: ctx.me.id,
  }));
  const { error } = await supabase.from("tasks").insert(rows);
  if (error) return { ok: false, error: friendlyError(error) };
  refresh(projectId);
  return { ok: true, message: `할 일 ${rows.length}개를 추가했어요` };
}
