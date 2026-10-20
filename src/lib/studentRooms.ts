import "server-only";
import { createClient } from "@/lib/supabase/server";
import { todayKST } from "@/lib/domain/dates";
import type { Project, Topic } from "@/lib/types";

export type StudentRoom = { project: Project; topic: Topic };

// 학생이 속한 방(주제마다 최대 1개)
export async function studentRooms(studentId: string): Promise<StudentRoom[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("project_members")
    .select("projects(*, topics(*))")
    .eq("student_id", studentId);
  const rooms: StudentRoom[] = [];
  for (const row of data ?? []) {
    const p = row.projects as unknown as (Project & { topics: Topic }) | null;
    if (p?.topics) rooms.push({ project: p, topic: p.topics });
  }
  return rooms;
}

// 진행 중인 최신 주제 우선, 없으면 가장 최근 주제
export function pickDefaultRoom(rooms: StudentRoom[], today = todayKST()): StudentRoom | null {
  const byLatest = [...rooms].sort((a, b) => (a.topic.start_date < b.topic.start_date ? 1 : -1));
  return byLatest.find((r) => r.topic.start_date <= today && today <= r.topic.end_date) ?? byLatest[0] ?? null;
}
