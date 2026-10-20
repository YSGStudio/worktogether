"use server";

import { requireTeacher } from "@/lib/auth";
import { loadStudentWork, type StudentWork } from "@/lib/studentWork";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/types";

// 활동 표에서 행을 펼칠 때 그 학생만 조회한다(교사 전용)
export async function getStudentTopicWork(topicId: string, studentId: string): Promise<ActionResult<StudentWork>> {
  await requireTeacher();
  const supabase = await createClient();
  const { data: topic } = await supabase.from("topics").select("id").eq("id", topicId).maybeSingle();
  if (!topic) return { ok: false, error: "권한이 없어요" };
  const { data: owns } = await supabase.rpc("is_teacher_of_topic", { p_topic: topicId });
  if (!owns) return { ok: false, error: "권한이 없어요" };
  return { ok: true, data: await loadStudentWork(topicId, studentId) };
}
