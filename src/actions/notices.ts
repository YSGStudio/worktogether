"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { loadProject } from "@/lib/project";
import { canEditScope } from "@/lib/domain/scope";
import { friendlyError } from "@/lib/errors";
import { optStr, str } from "@/lib/form";
import type { ActionResult } from "@/lib/types";

function refresh(projectId: string) {
  revalidatePath(`/p/${projectId}`, "layout");
  revalidatePath("/teacher", "layout");
}

function readNotice(fd: FormData) {
  return { title: str(fd, "title"), body: str(fd, "body"), group_id: optStr(fd, "group_id") };
}

export async function createNotice(projectId: string, _prev: unknown, fd: FormData): Promise<ActionResult> {
  const ctx = await loadProject(projectId);
  const input = readNotice(fd);
  if (!ctx.scope.isTeacher && !ctx.scope.isProjectLeader) input.group_id = ctx.scope.myGroupId;
  if (!input.title || !input.body) return { ok: false, error: "제목과 내용을 입력하세요" };
  if (input.group_id && !ctx.groups.some((g) => g.id === input.group_id)) return { ok: false, error: "모둠을 확인하세요" };
  if (!canEditScope(ctx.scope, input.group_id)) return { ok: false, error: "공지를 쓸 권한이 없어요" };
  const supabase = await createClient();
  const { error } = await supabase.from("notices").insert({ ...input, project_id: projectId, author_id: ctx.me.id });
  if (error) return { ok: false, error: friendlyError(error, "공지를 쓸 권한이 없어요") };
  refresh(projectId);
  return { ok: true, message: "공지를 올렸어요" };
}

export async function updateNotice(noticeId: string, _prev: unknown, fd: FormData): Promise<ActionResult> {
  await requireUser();
  const title = str(fd, "title");
  const body = str(fd, "body");
  if (!title || !body) return { ok: false, error: "제목과 내용을 입력하세요" };
  const supabase = await createClient();
  const { data, error } = await supabase.from("notices").update({ title, body }).eq("id", noticeId).select("project_id");
  if (error || !data?.length) return { ok: false, error: friendlyError(error, "권한이 없어요") };
  refresh(data[0].project_id);
  return { ok: true, message: "저장했어요" };
}

export async function deleteNotice(noticeId: string): Promise<ActionResult> {
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase.from("notices").delete().eq("id", noticeId).select("project_id");
  if (error || !data?.length) return { ok: false, error: friendlyError(error, "권한이 없어요") };
  refresh(data[0].project_id);
  return { ok: true, message: "공지를 지웠어요" };
}

export async function addComment(noticeId: string, _prev: unknown, fd: FormData): Promise<ActionResult> {
  const me = await requireUser();
  const body = str(fd, "body");
  if (!body) return { ok: false, error: "댓글을 입력하세요" };
  if (body.length > 1000) return { ok: false, error: "댓글은 1000자 이하로 써 주세요" };
  const supabase = await createClient();
  const { data: notice } = await supabase.from("notices").select("project_id").eq("id", noticeId).maybeSingle();
  if (!notice) return { ok: false, error: "공지를 찾을 수 없어요" };
  const { error } = await supabase.from("notice_comments").insert({ notice_id: noticeId, author_id: me.id, body });
  if (error) return { ok: false, error: friendlyError(error, "댓글을 달 수 없어요") };
  refresh(notice.project_id);
  return { ok: true };
}

async function commentProject(commentId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("notice_comments").select("notices(project_id)").eq("id", commentId).maybeSingle();
  return (data?.notices as unknown as { project_id: string } | null)?.project_id ?? null;
}

export async function updateComment(commentId: string, _prev: unknown, fd: FormData): Promise<ActionResult> {
  await requireUser();
  const body = str(fd, "body");
  if (!body) return { ok: false, error: "댓글을 입력하세요" };
  const projectId = await commentProject(commentId);
  const supabase = await createClient();
  const { data, error } = await supabase.from("notice_comments").update({ body }).eq("id", commentId).select("id");
  if (error || !data?.length) return { ok: false, error: friendlyError(error, "자기 댓글만 고칠 수 있어요") };
  if (projectId) refresh(projectId);
  return { ok: true, message: "고쳤어요" };
}

export async function deleteComment(commentId: string): Promise<ActionResult> {
  await requireUser();
  const projectId = await commentProject(commentId);
  const supabase = await createClient();
  const { data, error } = await supabase.from("notice_comments").delete().eq("id", commentId).select("id");
  if (error || !data?.length) return { ok: false, error: friendlyError(error, "남의 댓글은 지울 수 없어요") };
  if (projectId) refresh(projectId);
  return { ok: true, message: "댓글을 지웠어요" };
}
