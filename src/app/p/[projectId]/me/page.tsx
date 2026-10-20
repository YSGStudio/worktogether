import Link from "next/link";
import { StatusToggle } from "@/components/StatusToggle";
import { Card, Empty, formatRange, OverdueBadge, SectionTitle } from "@/components/ui";
import { isOverdue, sortByDueDate, todayKST } from "@/lib/domain/dates";
import { loadProject, nameMap, scopeLabel } from "@/lib/project";
import { assigneeLabel, withAssignees } from "@/lib/assignees";
import { createClient } from "@/lib/supabase/server";
import type { Task } from "@/lib/types";

// 내 할 일: 나에게 배정된 것만 마감일 순
export default async function MyTasks({ params }: PageProps<"/p/[projectId]/me">) {
  const { projectId } = await params;
  const ctx = await loadProject(projectId);
  const supabase = await createClient();
  // 나에게 배정된 할 일(다른 학생과 함께 맡은 일 포함)
  const { data: mine } = await supabase
    .from("task_assignees")
    .select("task_id")
    .eq("project_id", projectId)
    .eq("student_id", ctx.me.id);
  const ids = (mine ?? []).map((r) => r.task_id as string);
  const { data } = ids.length ? await supabase.from("tasks").select("*").in("id", ids) : { data: [] };
  const tasks = sortByDueDate(await withAssignees(supabase, (data ?? []) as Task[]));
  const names = nameMap(ctx);
  const today = todayKST();
  return (
    <Card>
      <SectionTitle>내 할 일 {tasks.length}개</SectionTitle>
      {tasks.length === 0 ? (
        <Empty>나에게 배정된 할 일이 없어요</Empty>
      ) : (
        <ul className="divide-y divide-stone-100" data-testid="my-tasks">
          {tasks.map((t) => (
            <li key={t.id} className="flex flex-col gap-2 py-3 md:flex-row md:items-center md:justify-between">
              <div className="min-w-0">
                <Link href={`/p/${projectId}/tasks/${t.id}`} className="text-lg font-semibold text-blue-800 hover:underline break-words">
                  {t.title}
                </Link>
                <p className="text-sm text-stone-600">
                  마감 {formatRange(t.due_date, t.due_date)} · {scopeLabel(ctx, t.group_id)}
                  {t.assignee_ids.length > 1 && ` · 함께: ${assigneeLabel(t, names)}`} {isOverdue(t, today) && <OverdueBadge />}
                </p>
              </div>
              <StatusToggle taskId={t.id} status={t.status} canChange />
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
