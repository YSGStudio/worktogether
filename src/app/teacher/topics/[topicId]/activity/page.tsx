import { requireTeacher } from "@/lib/auth";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActivityTable } from "@/components/teacher/ActivityTable";
import { BackLink, Card, Empty, PageTitle, SectionTitle } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import type { ActivityRow } from "@/lib/types";

export default async function ActivityPage({ params }: PageProps<"/teacher/topics/[topicId]/activity">) {
  await requireTeacher();
  const { topicId } = await params;
  const supabase = await createClient();
  const { data: topic } = await supabase.from("topics").select("id, title, class_id").eq("id", topicId).maybeSingle();
  if (!topic) notFound();
  const [{ data, error }, { data: students }] = await Promise.all([
    supabase.rpc("topic_student_activity", { p_topic: topicId }),
    supabase.from("profiles").select("id, name").eq("class_id", topic.class_id).order("name"),
  ]);
  if (error) notFound();
  const rows = (data ?? []) as ActivityRow[];
  const inRoom = new Set(rows.map((r) => r.student_id));
  const noRoom = (students ?? []).filter((s) => !inRoom.has(s.id));

  return (
    <>
      <BackLink href={`/teacher/topics/${topicId}`}>{topic.title}</BackLink>
      <PageTitle sub="학생 이름을 누르면 그 학생의 모든 작업을 볼 수 있어요">학생별 활동 모아보기</PageTitle>
      <Card>
        {rows.length === 0 ? <Empty>아직 방에 들어간 학생이 없어요</Empty> : <ActivityTable topicId={topicId} rows={rows} />}
      </Card>
      <Card className="mt-4">
        <SectionTitle>방 미배정 학생 {noRoom.length}명</SectionTitle>
        {noRoom.length === 0 ? (
          <p className="text-sm text-stone-500">모든 학생이 방에 들어가 있어요</p>
        ) : (
          <ul className="flex flex-wrap gap-2" data-testid="no-room-students">
            {noRoom.map((s) => (
              <li key={s.id}>
                <Link href={`/teacher/topics/${topicId}/students/${s.id}`} className="inline-block rounded-full border border-stone-300 bg-white px-3 py-1 text-sm hover:bg-stone-50">
                  {s.name}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
