"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireTeacher } from "@/lib/auth";
import { validateRange } from "@/lib/domain/dates";
import { friendlyError } from "@/lib/errors";
import { optStr, str, strList } from "@/lib/form";
import { removePaths, topicFilePaths } from "@/lib/storage";
import type { ActionResult } from "@/lib/types";

function readTopic(fd: FormData) {
  return {
    title: str(fd, "title"),
    goal: str(fd, "goal"),
    description: optStr(fd, "description"),
    start_date: str(fd, "start_date"),
    end_date: str(fd, "end_date"),
    leaders: [...new Set(strList(fd, "leaders"))],
  };
}

function checkTopic(t: ReturnType<typeof readTopic>): string | null {
  if (!t.title) return "주제 제목을 입력하세요";
  if (!t.goal) return "전체 목표를 입력하세요";
  const range = validateRange(t.start_date, t.end_date);
  if (range) return range;
  if (t.leaders.length === 0) return "팀장을 1명 이상 고르세요";
  return null;
}

export async function createTopic(classId: string, _prev: unknown, fd: FormData): Promise<ActionResult> {
  const me = await requireTeacher();
  const t = readTopic(fd);
  const invalid = checkTopic(t);
  if (invalid) return { ok: false, error: invalid };
  const supabase = await createClient();
  const { data: topic, error } = await supabase
    .from("topics")
    .insert({
      class_id: classId,
      teacher_id: me.id,
      title: t.title,
      goal: t.goal,
      description: t.description,
      start_date: t.start_date,
      end_date: t.end_date,
    })
    .select("id")
    .single();
  if (error || !topic) return { ok: false, error: friendlyError(error) };
  const { error: leaderError } = await supabase
    .from("topic_leaders")
    .insert(t.leaders.map((student_id) => ({ topic_id: topic.id, student_id })));
  if (leaderError) {
    await supabase.from("topics").delete().eq("id", topic.id);
    return { ok: false, error: friendlyError(leaderError) };
  }
  revalidatePath(`/teacher/classes/${classId}`);
  redirect(`/teacher/topics/${topic.id}`);
}

export async function updateTopic(topicId: string, _prev: unknown, fd: FormData): Promise<ActionResult> {
  await requireTeacher();
  const t = readTopic(fd);
  const invalid = checkTopic(t);
  if (invalid) return { ok: false, error: invalid };
  const supabase = await createClient();

  const { data: outside } = await supabase
    .from("projects")
    .select("name")
    .eq("topic_id", topicId)
    .or(`start_date.lt.${t.start_date},end_date.gt.${t.end_date}`);
  if (outside?.length) {
    return { ok: false, error: `새 기간을 벗어나는 방이 있어요: ${outside.map((p) => p.name).join(", ")}. 방 기간을 먼저 바꾸세요.` };
  }

  const { data, error } = await supabase
    .from("topics")
    .update({ title: t.title, goal: t.goal, description: t.description, start_date: t.start_date, end_date: t.end_date })
    .eq("id", topicId)
    .select("id");
  if (error || !data?.length) return { ok: false, error: friendlyError(error, "권한이 없어요") };

  const { data: current } = await supabase.from("topic_leaders").select("student_id").eq("topic_id", topicId);
  const before = new Set((current ?? []).map((r) => r.student_id as string));
  const after = new Set(t.leaders);
  const removed = [...before].filter((id) => !after.has(id));
  const added = [...after].filter((id) => !before.has(id));
  if (removed.length) {
    // 빠진 팀장이 이끌던 방은 트리거가 "팀장 없음"으로 바꾼다
    const { error: e } = await supabase.from("topic_leaders").delete().eq("topic_id", topicId).in("student_id", removed);
    if (e) return { ok: false, error: friendlyError(e) };
  }
  if (added.length) {
    const { error: e } = await supabase.from("topic_leaders").insert(added.map((student_id) => ({ topic_id: topicId, student_id })));
    if (e) return { ok: false, error: friendlyError(e) };
  }
  revalidatePath(`/teacher/topics/${topicId}`, "layout");
  return { ok: true, message: "저장했어요" };
}

export async function deleteTopic(topicId: string): Promise<ActionResult> {
  await requireTeacher();
  const supabase = await createClient();
  const { data: topic } = await supabase.from("topics").select("id, class_id").eq("id", topicId).maybeSingle();
  if (!topic) return { ok: false, error: "권한이 없어요" };
  // 소유 확인 후 Storage 파일을 먼저 지운다
  const { data: own } = await supabase.from("classes").select("id").eq("id", topic.class_id).maybeSingle();
  if (!own) return { ok: false, error: "권한이 없어요" };
  const admin = createAdminClient();
  const paths = await topicFilePaths(admin, [topicId]);
  const { error } = await supabase.from("topics").delete().eq("id", topicId);
  if (error) return { ok: false, error: friendlyError(error) };
  await removePaths(admin, paths);
  revalidatePath(`/teacher/classes/${topic.class_id}`);
  redirect(`/teacher/classes/${topic.class_id}`);
}
