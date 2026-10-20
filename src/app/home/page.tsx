import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { pickDefaultRoom, studentRooms } from "@/lib/studentRooms";
import { Main, TopBar } from "@/components/TopBar";
import { btn, Card, Empty, PageTitle, formatRange } from "@/components/ui";
import type { Topic } from "@/lib/types";

// 로그인 직후 첫 화면: 교사 → 학급 목록, 학생 → 진행 중인 최신 주제의 내 방 대시보드
export default async function Home() {
  const me = await requireUser();
  if (me.role === "teacher") redirect("/teacher");

  const rooms = await studentRooms(me.id);
  const room = pickDefaultRoom(rooms);
  if (room) redirect(`/p/${room.project.id}`);

  const supabase = await createClient();
  const [{ data: topics }, { data: leads }] = await Promise.all([
    supabase.from("topics").select("*").order("start_date", { ascending: false }),
    supabase.from("topic_leaders").select("topic_id").eq("student_id", me.id),
  ]);
  const leaderOf = new Set((leads ?? []).map((l) => l.topic_id as string));

  return (
    <>
      <TopBar me={me} />
      <Main>
        <PageTitle sub={`${me.name}님, 반가워요!`}>아직 프로젝트 방이 없어요</PageTitle>
        <p className="mb-4 text-stone-700">선생님이 방에 넣어 주면 여기에서 바로 볼 수 있어요.</p>
        {(topics ?? []).length === 0 ? (
          <Empty>아직 등록된 주제가 없어요</Empty>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {(topics as Topic[]).map((t) => (
              <Card key={t.id}>
                <h2 className="text-lg font-bold break-words">{t.title}</h2>
                <p className="text-sm text-stone-600">{formatRange(t.start_date, t.end_date)}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link href={`/t/${t.id}`} className={btn.secondary}>
                    주제 보기
                  </Link>
                  {leaderOf.has(t.id) && (
                    <Link href={`/t/${t.id}#new-room`} className={btn.primary}>
                      방 만들기
                    </Link>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </Main>
    </>
  );
}
