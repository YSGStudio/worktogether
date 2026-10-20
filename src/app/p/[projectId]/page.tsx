import Link from "next/link";
import { AttachmentGallery } from "@/components/AttachmentGallery";
import { GroupTabs, UnassignedNotice } from "@/components/GroupTabs";
import { Timeline } from "@/components/Timeline";
import { Card, formatDateTime, formatRange, Progress, SectionTitle } from "@/components/ui";
import { todayKST } from "@/lib/domain/dates";
import { assigneeLabel } from "@/lib/assignees";
import { toGalleryItems } from "@/lib/gallery";
import { loadProject, resolveView, scopeLabel } from "@/lib/project";
import { loadNotices, loadProjectAttachments, loadWorkspace } from "@/lib/workspace";

export default async function Dashboard({ params, searchParams }: PageProps<"/p/[projectId]">) {
  const { projectId } = await params;
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (typeof v === "string" && v ? v : undefined);
  const ctx = await loadProject(projectId);
  const [ws, notices, projectAttachments] = await Promise.all([
    loadWorkspace(ctx, one(sp.view)),
    loadNotices(ctx, resolveView(ctx, one(sp.view)), 3),
    loadProjectAttachments(projectId),
  ]);
  const today = todayKST();
  const visibleTaskIds = new Set(ws.tasks.map((t) => t.id));
  const items = await toGalleryItems(projectAttachments.filter((a) => visibleTaskIds.has(a.task_id)), ws.tasks, ws.names);
  const done = ws.tasks.filter((t) => t.status === "done").length;
  const base = `/p/${projectId}`;

  return (
    <>
      <GroupTabs ctx={ctx} basePath={base} view={ws.view} />
      {ws.unassignedInGroupRoom && <UnassignedNotice />}

      <Card>
        <div className="grid gap-4 md:grid-cols-[1fr_280px]">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-stone-500">주제 목표</p>
            <p className="font-semibold break-words">{ctx.topic.goal}</p>
            {ctx.project.description && <p className="mt-1 text-stone-600 break-words">{ctx.project.description}</p>}
            <p className="mt-2 text-sm text-stone-600">
              방 기간 {formatRange(ctx.project.start_date, ctx.project.end_date)}
              {ctx.myGroup && ` · 내 모둠: ${ctx.myGroup.name}`}
              {ws.view && ` · 보는 중: ${scopeLabel(ctx, ws.view)}`}
            </p>
          </div>
          <Progress done={done} total={ws.tasks.length} />
        </div>
      </Card>

      <Card className="mt-4">
        <SectionTitle right={<Link href={`${base}/tasks`} className="text-sm text-blue-700 hover:underline">할 일 전체 보기 →</Link>}>
          흐름도
        </SectionTitle>
        <Timeline
          rangeStart={ctx.project.start_date}
          rangeEnd={ctx.project.end_date}
          today={today}
          sections={ws.sections.map((s) => ({
            key: s.key,
            title: s.title,
            tasks: s.tasks.map((t) => ({ ...t, assigneeName: t.assignee_ids.length ? assigneeLabel(t, ws.names) : null })),
          }))}
          taskHref={(id) => `${base}/tasks/${id}`}
        />
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_340px]">
        <Card>
          <SectionTitle>자료 모음</SectionTitle>
          <AttachmentGallery items={items} tasks={ws.tasks} basePath={base} filter={{ task: one(sp.task), kind: one(sp.kind), view: ws.view }} />
        </Card>
        <Card>
          <SectionTitle right={<Link href={`${base}/notices`} className="text-sm text-blue-700 hover:underline">공지 전체 →</Link>}>
            최근 공지
          </SectionTitle>
          {notices.length === 0 ? (
            <p className="text-sm text-stone-500">공지가 없어요</p>
          ) : (
            <ul className="space-y-3">
              {notices.map((n) => (
                <li key={n.id} className="min-w-0">
                  <Link href={`${base}/notices#notice-${n.id}`} className="font-semibold hover:underline break-words">
                    {n.title}
                  </Link>
                  <p className="text-xs text-stone-500">
                    {scopeLabel(ctx, n.group_id)} · {(n.author_id && ws.names[n.author_id]) || ""} · {formatDateTime(n.created_at)}
                  </p>
                  <p className="line-clamp-2 text-sm text-stone-700 break-words">{n.body}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
