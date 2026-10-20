"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireTeacher, requireUser } from "@/lib/auth";
import { validateRangeWithin } from "@/lib/domain/dates";
import { friendlyError } from "@/lib/errors";
import { optStr, str, strList } from "@/lib/form";
import { projectFilePaths, removePaths } from "@/lib/storage";
import type { ActionResult } from "@/lib/types";

function refresh(projectId: string, topicId?: string) {
  revalidatePath(`/p/${projectId}`, "layout");
  if (topicId) {
    revalidatePath(`/teacher/topics/${topicId}`, "layout");
    revalidatePath(`/t/${topicId}`);
  }
}

// 교사 또는 팀장이 방을 만든다
export async function createProject(topicId: string, _prev: unknown, fd: FormData): Promise<ActionResult> {
  const me = await requireUser();
  const supabase = await createClient();
  const { data: topic } = await supabase.from("topics").select("*").eq("id", topicId).maybeSingle();
  if (!topic) return { ok: false, error: "주제를 찾을 수 없어요" };

  const name = str(fd, "name");
  const description = optStr(fd, "description");
  const start = str(fd, "start_date") || topic.start_date;
  const end = str(fd, "end_date") || topic.end_date;
  if (!name) return { ok: false, error: "방 이름을 입력하세요" };
  const range = validateRangeWithin(start, end, { start: topic.start_date, end: topic.end_date });
  if (range) return { ok: false, error: range };

  if (me.role !== "teacher") {
    const { data: lead } = await supabase
      .from("topic_leaders")
      .select("student_id")
      .eq("topic_id", topicId)
      .eq("student_id", me.id)
      .maybeSingle();
    if (!lead) return { ok: false, error: "이 주제의 팀장만 방을 만들 수 있어요" };
  }

  // 학생이 만든 방은 트리거가 만든 학생을 팀장·구성원으로 넣는다(그 전에는 방을 읽을 수 없어 id를 미리 정한다)
  const projectId = randomUUID();
  const { error } = await supabase
    .from("projects")
    .insert({ id: projectId, topic_id: topicId, name, description, start_date: start, end_date: end, created_by: me.id });
  if (error) return { ok: false, error: friendlyError(error, "방을 만들 권한이 없어요") };

  if (me.role === "teacher") {
    const leaderIds = [...new Set(strList(fd, "leader_ids"))];
    if (leaderIds.length) {
      const { error: leaderError } = await supabase
        .from("project_leaders")
        .insert(leaderIds.map((student_id) => ({ project_id: projectId, topic_id: topicId, student_id })));
      if (leaderError) {
        refresh(projectId, topicId);
        return { ok: false, error: `방은 만들었지만 팀장을 정하지 못했어요: ${friendlyError(leaderError)}` };
      }
    }
  }
  refresh(projectId, topicId);
  redirect(me.role === "teacher" ? `/teacher/topics/${topicId}` : `/p/${projectId}`);
}

export async function updateProject(projectId: string, _prev: unknown, fd: FormData): Promise<ActionResult> {
  await requireUser();
  const supabase = await createClient();
  const { data: project } = await supabase.from("projects").select("topic_id").eq("id", projectId).maybeSingle();
  if (!project) return { ok: false, error: "권한이 없어요" };
  const { data: topic } = await supabase.from("topics").select("start_date, end_date").eq("id", project.topic_id).single();
  const name = str(fd, "name");
  const start = str(fd, "start_date");
  const end = str(fd, "end_date");
  if (!name) return { ok: false, error: "방 이름을 입력하세요" };
  if (topic) {
    const range = validateRangeWithin(start, end, { start: topic.start_date, end: topic.end_date });
    if (range) return { ok: false, error: range };
  }
  // 기간을 줄일 때 새 기간을 벗어나는 할 일이 있으면 먼저 고치게 한다
  const { data: outside } = await supabase
    .from("tasks")
    .select("title")
    .eq("project_id", projectId)
    .or(`start_date.lt.${start},due_date.lt.${start},start_date.gt.${end},due_date.gt.${end}`);
  if (outside?.length) {
    return { ok: false, error: `새 기간을 벗어나는 할 일이 있어요: ${outside.map((t) => t.title).join(", ")}. 할 일 날짜를 먼저 바꾸세요.` };
  }
  const { data, error } = await supabase
    .from("projects")
    .update({ name, description: optStr(fd, "description"), start_date: start, end_date: end })
    .eq("id", projectId)
    .select("id");
  if (error || !data?.length) return { ok: false, error: friendlyError(error, "권한이 없어요") };
  refresh(projectId, project.topic_id);
  return { ok: true, message: "저장했어요" };
}

// 공동 팀장 정하기(교사): 체크한 팀장만 남긴다
export async function setProjectLeaders(projectId: string, _prev: unknown, fd: FormData): Promise<ActionResult> {
  await requireTeacher();
  const supabase = await createClient();
  const { data: project } = await supabase.from("projects").select("topic_id").eq("id", projectId).maybeSingle();
  if (!project) return { ok: false, error: "권한이 없어요" };
  const wanted = new Set(strList(fd, "leader_ids"));
  const { data: current } = await supabase.from("project_leaders").select("student_id").eq("project_id", projectId);
  const before = new Set((current ?? []).map((r) => r.student_id as string));
  const removed = [...before].filter((id) => !wanted.has(id));
  const added = [...wanted].filter((id) => !before.has(id));
  if (removed.length) {
    const { error } = await supabase.from("project_leaders").delete().eq("project_id", projectId).in("student_id", removed);
    if (error) return { ok: false, error: friendlyError(error, "권한이 없어요") };
  }
  if (added.length) {
    const { error } = await supabase
      .from("project_leaders")
      .insert(added.map((student_id) => ({ project_id: projectId, topic_id: project.topic_id, student_id })));
    if (error) {
      if (error.code === "23505") return { ok: false, error: "이미 다른 방을 이끄는 팀장이 있어요" };
      return { ok: false, error: friendlyError(error, "권한이 없어요") };
    }
  }
  refresh(projectId, project.topic_id);
  return { ok: true, message: wanted.size ? `팀장 ${wanted.size}명을 정했어요` : "팀장을 모두 뺐어요" };
}

export async function deleteProject(projectId: string): Promise<ActionResult> {
  const me = await requireTeacher();
  const supabase = await createClient();
  const { data: project } = await supabase.from("projects").select("topic_id").eq("id", projectId).maybeSingle();
  if (!project) return { ok: false, error: "권한이 없어요" };
  const { data: own } = await supabase.from("topics").select("id").eq("id", project.topic_id).eq("teacher_id", me.id).maybeSingle();
  if (!own) return { ok: false, error: "권한이 없어요" };
  const admin = createAdminClient();
  const paths = await projectFilePaths(admin, [projectId]);
  const { error } = await supabase.from("projects").delete().eq("id", projectId);
  if (error) return { ok: false, error: friendlyError(error) };
  await removePaths(admin, paths);
  refresh(projectId, project.topic_id);
  redirect(`/teacher/topics/${project.topic_id}`);
}

// 학생 추가·제외는 교사만 (RLS)
export async function addProjectMembers(projectId: string, _prev: unknown, fd: FormData): Promise<ActionResult> {
  await requireTeacher();
  const ids = [...new Set(strList(fd, "student_ids"))];
  if (ids.length === 0) return { ok: false, error: "추가할 학생을 고르세요" };
  const supabase = await createClient();
  const { data: project } = await supabase.from("projects").select("topic_id").eq("id", projectId).maybeSingle();
  if (!project) return { ok: false, error: "권한이 없어요" };
  const { error } = await supabase
    .from("project_members")
    .insert(ids.map((student_id) => ({ project_id: projectId, topic_id: project.topic_id, student_id })));
  if (error) {
    if (error.code === "23505") return { ok: false, error: "이미 이 주제의 다른 방에 속한 학생이 있어요" };
    return { ok: false, error: friendlyError(error, "권한이 없어요") };
  }
  refresh(projectId, project.topic_id);
  return { ok: true, message: `${ids.length}명을 추가했어요` };
}

export async function removeProjectMember(projectId: string, studentId: string): Promise<ActionResult> {
  await requireTeacher();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("project_members")
    .delete()
    .eq("project_id", projectId)
    .eq("student_id", studentId)
    .select("topic_id");
  if (error || !data?.length) return { ok: false, error: friendlyError(error, "권한이 없어요") };
  refresh(projectId, data[0].topic_id);
  return { ok: true, message: "방에서 뺐어요" };
}

// ── 모둠 (교사만) ──

export async function createGroup(projectId: string, _prev: unknown, fd: FormData): Promise<ActionResult> {
  await requireTeacher();
  const name = str(fd, "name");
  if (!name) return { ok: false, error: "모둠 이름을 입력하세요" };
  const supabase = await createClient();
  const { error } = await supabase.from("groups").insert({ project_id: projectId, name });
  if (error) return { ok: false, error: friendlyError(error, "권한이 없어요") };
  refresh(projectId);
  return { ok: true, message: "모둠을 만들었어요" };
}

export async function renameGroup(groupId: string, _prev: unknown, fd: FormData): Promise<ActionResult> {
  await requireTeacher();
  const name = str(fd, "name");
  if (!name) return { ok: false, error: "모둠 이름을 입력하세요" };
  const supabase = await createClient();
  const { data, error } = await supabase.from("groups").update({ name }).eq("id", groupId).select("project_id");
  if (error || !data?.length) return { ok: false, error: friendlyError(error, "권한이 없어요") };
  refresh(data[0].project_id);
  return { ok: true, message: "저장했어요" };
}

// 모둠을 지우면 그 모둠의 할 일·공지는 방 공통 항목이 된다(group_id → null)
export async function deleteGroup(groupId: string): Promise<ActionResult> {
  await requireTeacher();
  const supabase = await createClient();
  const { data, error } = await supabase.from("groups").delete().eq("id", groupId).select("project_id");
  if (error || !data?.length) return { ok: false, error: friendlyError(error, "권한이 없어요") };
  refresh(data[0].project_id);
  return { ok: true, message: "모둠을 지웠어요. 그 모둠의 할 일과 공지는 방 공통 항목이 되었어요." };
}

// 학생을 모둠에 배치·이동·미배치. 이동하면 이전 모둠 할 일 담당은 트리거가 해제한다.
export async function setGroupMember(projectId: string, studentId: string, _prev: unknown, fd: FormData): Promise<ActionResult> {
  await requireTeacher();
  const groupId = optStr(fd, "group_id");
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("group_members")
    .select("group_id")
    .eq("project_id", projectId)
    .eq("student_id", studentId)
    .maybeSingle();
  let error;
  if (!groupId) {
    ({ error } = await supabase.from("group_members").delete().eq("project_id", projectId).eq("student_id", studentId));
  } else if (existing) {
    if (existing.group_id === groupId) return { ok: true };
    ({ error } = await supabase
      .from("group_members")
      .update({ group_id: groupId })
      .eq("project_id", projectId)
      .eq("student_id", studentId));
  } else {
    ({ error } = await supabase.from("group_members").insert({ group_id: groupId, project_id: projectId, student_id: studentId }));
  }
  if (error) return { ok: false, error: friendlyError(error, "권한이 없어요") };
  refresh(projectId);
  return { ok: true, message: "모둠을 바꿨어요" };
}

export async function setGroupLeader(groupId: string, _prev: unknown, fd: FormData): Promise<ActionResult> {
  await requireTeacher();
  const leaderId = optStr(fd, "leader_id");
  const supabase = await createClient();
  const { data, error } = await supabase.from("groups").update({ leader_id: leaderId }).eq("id", groupId).select("project_id");
  if (error || !data?.length) return { ok: false, error: friendlyError(error, "권한이 없어요") };
  refresh(data[0].project_id);
  return { ok: true, message: "모둠장을 정했어요" };
}
