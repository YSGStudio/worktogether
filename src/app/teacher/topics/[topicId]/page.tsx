import { requireTeacher } from "@/lib/auth";
import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteTopic, updateTopic } from "@/actions/topics";
import { ConfirmButton } from "@/components/ConfirmButton";
import { RoomCreateForm } from "@/components/RoomCreateForm";
import { TopicForm } from "@/components/teacher/TopicForm";
import { Badge, BackLink, btn, Card, Empty, formatRange, PageTitle, Progress, SectionTitle } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { projectStats } from "@/lib/progress";
import type { Profile, Project, Topic } from "@/lib/types";

export default async function TeacherTopic({ params }: PageProps<"/teacher/topics/[topicId]">) {
  await requireTeacher();
  const { topicId } = await params;
  const supabase = await createClient();
  const { data: topicRow } = await supabase.from("topics").select("*").eq("id", topicId).maybeSingle();
  if (!topicRow) notFound();
  const topic = topicRow as Topic;
  const [{ data: cls }, { data: studentRows }, { data: leaderRows }, { data: projectRows }] = await Promise.all([
    supabase.from("classes").select("id, name").eq("id", topic.class_id).single(),
    supabase.from("profiles").select("id, role, name, class_id").eq("class_id", topic.class_id).order("name"),
    supabase.from("topic_leaders").select("student_id").eq("topic_id", topicId),
    supabase.from("projects").select("*").eq("topic_id", topicId).order("created_at"),
  ]);
  const students = (studentRows ?? []) as Profile[];
  const nameOf = Object.fromEntries(students.map((s) => [s.id, s.name]));
  const leaderIds = (leaderRows ?? []).map((l) => l.student_id as string);
  const projects = (projectRows ?? []) as Project[];
  const [stats, { data: roomLeaderRows }, { data: memberRows }] = await Promise.all([
    projectStats(supabase, projects.map((p) => p.id)),
    supabase.from("project_leaders").select("project_id, student_id").eq("topic_id", topicId),
    supabase.from("project_members").select("student_id").eq("topic_id", topicId),
  ]);
  const leadersOf: Record<string, string[]> = {};
  for (const r of roomLeaderRows ?? []) (leadersOf[r.project_id] ??= []).push(nameOf[r.student_id] ?? "?");
  // 아직 어느 방에도 속하지 않은 주제 팀장만 새 방의 팀장 후보
  const inRoom = new Set((memberRows ?? []).map((m) => m.student_id as string));
  const freeLeaders = leaderIds.filter((id) => !inRoom.has(id)).map((id) => ({ id, name: nameOf[id] ?? "?" }));

  return (
    <>
      <BackLink href={`/teacher/classes/${topic.class_id}`}>{cls?.name ?? "학급"}</BackLink>
      <PageTitle sub={`${formatRange(topic.start_date, topic.end_date)} · 목표: ${topic.goal}`}>{topic.title}</PageTitle>
      <div className="mb-4 flex flex-wrap gap-2">
        <Link href={`/teacher/topics/${topicId}/activity`} className={btn.primary}>
          학생별 활동 모아보기
        </Link>
      </div>

      <Card>
        <SectionTitle>프로젝트 방 {projects.length}개</SectionTitle>
        {projects.length === 0 ? (
          <Empty>아직 방이 없어요. 팀장이 직접 만들거나 아래에서 만들 수 있어요.</Empty>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {projects.map((p) => (
              <div key={p.id} className="rounded-lg border border-stone-200 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Link href={`/p/${p.id}`} className="text-lg font-bold text-blue-700 hover:underline break-words">
                    {p.name}
                  </Link>
                  {!leadersOf[p.id]?.length && <Badge tone="amber">팀장 없는 방</Badge>}
                </div>
                <p className="text-sm text-stone-600">
                  팀장 {leadersOf[p.id]?.join(", ") || "없음"} · {stats[p.id].members}명 · 모둠 {stats[p.id].groups}개 ·{" "}
                  {formatRange(p.start_date, p.end_date)}
                </p>
                <div className="mt-2">
                  <Progress done={stats[p.id].done} total={stats[p.id].total} />
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Link href={`/p/${p.id}`} className={btn.small}>대시보드</Link>
                  <Link href={`/p/${p.id}/members`} className={btn.small}>구성원·모둠</Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <SectionTitle>방 만들기</SectionTitle>
          <RoomCreateForm topic={topic} leaderChoices={freeLeaders} />
        </Card>
        <Card>
          <SectionTitle>주제 정보·팀장 수정</SectionTitle>
          <p className="mb-3 text-sm text-stone-600">팀장을 목록에서 빼면 그 학생이 이끌던 방은 &quot;팀장 없음&quot;이 돼요.</p>
          <TopicForm action={updateTopic.bind(null, topicId)} students={students} topic={topic} leaderIds={leaderIds} submitLabel="저장" />
          <div className="mt-4 border-t pt-4">
            <ConfirmButton action={deleteTopic.bind(null, topicId)} confirm="이 주제를 지울까요? 모든 방·할 일·자료·공지가 함께 지워져요.">
              주제 삭제
            </ConfirmButton>
          </div>
        </Card>
      </div>
    </>
  );
}
