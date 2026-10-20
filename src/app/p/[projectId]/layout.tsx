import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { loadProject } from "@/lib/project";
import { studentRooms } from "@/lib/studentRooms";
import { Main, TopBar } from "@/components/TopBar";
import { Badge, formatRange } from "@/components/ui";

export default async function ProjectLayout({ children, params }: LayoutProps<"/p/[projectId]">) {
  const { projectId } = await params;
  const ctx = await loadProject(projectId);
  const { me, project, topic, scope } = ctx;

  // 상단 선택기: 학생은 내가 속한 방(주제별), 교사는 같은 주제의 다른 방
  let switchList: { id: string; label: string }[];
  if (me.role === "student") {
    switchList = (await studentRooms(me.id)).map((r) => ({ id: r.project.id, label: `${r.topic.title} · ${r.project.name}` }));
  } else {
    const supabase = await createClient();
    const { data } = await supabase.from("projects").select("id, name").eq("topic_id", topic.id).order("created_at");
    switchList = (data ?? []).map((p) => ({ id: p.id, label: p.name }));
  }

  const nav = [
    { href: `/p/${projectId}`, label: "대시보드" },
    { href: `/p/${projectId}/tasks`, label: "할 일" },
    ...(scope.isMember ? [{ href: `/p/${projectId}/me`, label: "내 할 일" }] : []),
    { href: `/p/${projectId}/notices`, label: "공지" },
    { href: `/p/${projectId}/members`, label: scope.isTeacher ? "구성원·모둠" : "구성원" },
  ];

  const roleBadge = scope.isTeacher ? "선생님" : scope.isProjectLeader ? "팀장" : scope.isMyGroupLeader ? "모둠장" : null;

  return (
    <>
      <TopBar me={me} />
      <div className="no-print border-b border-[#dfe1eb] bg-white/95 shadow-sm backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 pt-4 sm:px-6">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-bold text-[#5865f2] break-words">
                {me.role === "teacher" ? (
                  <Link href={`/teacher/topics/${topic.id}`} className="hover:underline">{topic.title}</Link>
                ) : (
                  <Link href={`/t/${topic.id}`} className="hover:underline">{topic.title}</Link>
                )}
              </p>
              <h1 className="flex flex-wrap items-center gap-2 text-xl font-black text-[#24253a] break-words sm:text-2xl">
                {project.name}
                {ctx.myGroup && <Badge tone="violet">{ctx.myGroup.name}</Badge>}
                {roleBadge && <Badge tone="blue">{roleBadge}</Badge>}
              </h1>
              <p className="text-sm text-stone-600">
                {formatRange(project.start_date, project.end_date)} · 팀장 {ctx.leaderNames.join(", ") || "없음"}
              </p>
            </div>
            {switchList.length > 1 && (
              <details className="relative">
                <summary className="cursor-pointer rounded-xl border-2 border-[#d9dcef] px-3 py-1.5 text-sm font-bold text-[#4c4f68] hover:border-[#aeb4f8] hover:bg-[#f5f6ff]">다른 방 보기</summary>
                <ul className="absolute right-0 z-20 mt-2 max-h-72 w-64 max-w-[80vw] overflow-auto rounded-xl border border-[#dfe1eb] bg-white py-1 shadow-xl">
                  {switchList.map((r) => (
                    <li key={r.id}>
                      <Link href={`/p/${r.id}`} className={`block truncate px-3 py-2 text-sm hover:bg-[#f0f1ff] ${r.id === projectId ? "font-bold text-[#5865f2]" : ""}`}>
                        {r.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
          <nav className="mt-3 flex gap-1.5 overflow-x-auto pb-0">
            {nav.map((n) => (
              <Link key={n.href} href={n.href} className="rounded-t-xl border-b-[3px] border-transparent px-3 py-2 text-sm font-extrabold whitespace-nowrap text-[#5a5d72] hover:border-[#5865f2] hover:bg-[#f0f1ff] hover:text-[#4752c4]">
                {n.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
      <Main>{children}</Main>
    </>
  );
}
