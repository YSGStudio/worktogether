import { AiTaskGenerator } from "@/components/AiTaskGenerator";
import { GroupTabs, UnassignedNotice } from "@/components/GroupTabs";
import { TaskForm } from "@/components/TaskForm";
import { TaskList } from "@/components/TaskList";
import { Card, SectionTitle } from "@/components/ui";
import { createTask } from "@/actions/tasks";
import { todayKST } from "@/lib/domain/dates";
import { editableScopes, loadProject } from "@/lib/project";
import { loadWorkspace } from "@/lib/workspace";

export default async function TasksPage({ params, searchParams }: PageProps<"/p/[projectId]/tasks">) {
  const { projectId } = await params;
  const { view } = await searchParams;
  const ctx = await loadProject(projectId);
  const ws = await loadWorkspace(ctx, typeof view === "string" ? view : undefined);
  const scopes = editableScopes(ctx);
  const range = { start: ctx.project.start_date, end: ctx.project.end_date };
  const today = todayKST();
  const base = `/p/${projectId}`;

  return (
    <>
      <GroupTabs ctx={ctx} basePath={`${base}/tasks`} view={ws.view} />
      {ws.unassignedInGroupRoom && <UnassignedNotice />}
      <div className={`grid gap-4 ${scopes.length ? "lg:grid-cols-[1fr_380px]" : ""}`}>
        <div className="space-y-4">
          {ws.sections.map((s) => (
            <Card key={s.key}>
              <SectionTitle>
                {s.title} <span className="text-sm font-normal text-stone-500">{s.tasks.length}개</span>
              </SectionTitle>
              <TaskList tasks={s.tasks} names={ws.names} today={today} hrefFor={(t) => `${base}/tasks/${t.id}`} grid={ctx.me.role === "student"} />
            </Card>
          ))}
        </div>
        {scopes.length > 0 && (
          <div className="space-y-4">
            <Card>
              <SectionTitle>할 일 추가</SectionTitle>
              <TaskForm action={createTask.bind(null, projectId)} scopes={scopes} range={range} submitLabel="추가" />
            </Card>
            <Card>
              <SectionTitle>AI로 할 일 만들기</SectionTitle>
              <AiTaskGenerator projectId={projectId} scopes={scopes.map(({ groupId, label }) => ({ groupId, label }))} range={range} />
            </Card>
          </div>
        )}
      </div>
    </>
  );
}
