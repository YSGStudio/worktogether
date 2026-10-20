import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Main, TopBar } from "@/components/TopBar";
import { RoomCreateForm } from "@/components/RoomCreateForm";
import { Badge, BackLink, btn, Card, Empty, formatRange, PageTitle, SectionTitle } from "@/components/ui";
import type { Topic } from "@/lib/types";

type Room = { id: string; name: string; leader_names: string | null; is_mine: boolean };

// 학생용 주제 화면: 다른 방은 이름과 팀장 이름만 보인다
export default async function StudentTopic({ params }: PageProps<"/t/[topicId]">) {
  const { topicId } = await params;
  const me = await requireUser();
  const supabase = await createClient();
  const { data: topicRow } = await supabase.from("topics").select("*").eq("id", topicId).maybeSingle();
  if (!topicRow) notFound();
  const topic = topicRow as Topic;
  const [{ data: roomRows }, { data: lead }] = await Promise.all([
    supabase.rpc("topic_rooms", { p_topic: topicId }),
    supabase.from("topic_leaders").select("student_id").eq("topic_id", topicId).eq("student_id", me.id).maybeSingle(),
  ]);
  const rooms = (roomRows ?? []) as Room[];
  const mine = rooms.find((r) => r.is_mine);
  const isLeader = !!lead;

  return (
    <>
      <TopBar me={me} />
      <Main>
        <BackLink href="/home">처음으로</BackLink>
        <PageTitle sub={`${formatRange(topic.start_date, topic.end_date)} · 목표: ${topic.goal}`}>{topic.title}</PageTitle>
        {mine && (
          <Link href={`/p/${mine.id}`} className={`${btn.primary} mb-4`}>
            내 방으로 가기: {mine.name}
          </Link>
        )}
        <Card>
          <SectionTitle>프로젝트 방</SectionTitle>
          {rooms.length === 0 ? (
            <Empty>아직 방이 없어요</Empty>
          ) : (
            <ul className="divide-y">
              {rooms.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-2 py-2">
                  <span className="font-semibold break-words">{r.name}</span>
                  <span className="text-sm text-stone-600">팀장 {r.leader_names ?? "없음"}</span>
                  {r.is_mine && <Badge tone="blue">내 방</Badge>}
                </li>
              ))}
            </ul>
          )}
        </Card>
        {isLeader && !mine && (
          <Card className="mt-4">
            <div id="new-room" />
            <SectionTitle>방 만들기</SectionTitle>
            <p className="mb-3 text-sm text-stone-600">나는 이 주제의 팀장이에요. 방을 만들면 내가 방 팀장이 돼요.</p>
            <RoomCreateForm topic={topic} />
          </Card>
        )}
      </Main>
    </>
  );
}
