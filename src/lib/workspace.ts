import "server-only";
import { createClient } from "@/lib/supabase/server";
import { fromTaskRows, TASK_WITH_ASSIGNEES } from "@/lib/assignees";
import { canViewScope } from "@/lib/domain/scope";
import { nameMap, resolveView, type ProjectContext } from "@/lib/project";
import type { Attachment, Notice, Task } from "@/lib/types";

export type WorkspaceSection = { key: string; title: string; groupId: string | null; tasks: Task[] };

export type Workspace = {
  view: string | undefined; // 팀장·교사가 고른 모둠 탭
  tasks: Task[];
  sections: WorkspaceSection[];
  names: Record<string, string>;
  unassignedInGroupRoom: boolean; // 모둠 방 미배치 학생
};

// 보이는 범위의 할 일(RLS가 1차로 거른다)을 작업 공간 구역으로 나눈다. 방 공통 구역이 맨 위.
export async function loadWorkspace(ctx: ProjectContext, viewParam?: string): Promise<Workspace> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("tasks")
    .select(TASK_WITH_ASSIGNEES)
    .eq("project_id", ctx.project.id)
    .order("sort_order")
    .order("created_at");
  const view = resolveView(ctx, viewParam);
  let tasks = fromTaskRows(data ?? []).filter((t) => canViewScope(ctx.scope, t.group_id));
  if (view) tasks = tasks.filter((t) => t.group_id === null || t.group_id === view);

  let sections: WorkspaceSection[];
  if (ctx.kind === "whole") {
    sections = [{ key: "all", title: "방 전체", groupId: null, tasks }];
  } else {
    const groups = ctx.groups.filter((g) => canViewScope(ctx.scope, g.id) && (!view || g.id === view));
    sections = [
      { key: "common", title: "방 공통", groupId: null, tasks: tasks.filter((t) => t.group_id === null) },
      ...groups.map((g) => ({ key: g.id, title: g.name, groupId: g.id, tasks: tasks.filter((t) => t.group_id === g.id) })),
    ];
  }

  return {
    view,
    tasks,
    sections,
    names: nameMap(ctx),
    unassignedInGroupRoom:
      ctx.kind === "grouped" && ctx.scope.isMember && !ctx.scope.myGroupId && !ctx.scope.isProjectLeader && !ctx.scope.isTeacher,
  };
}

export async function loadAttachments(taskIds: string[]): Promise<Attachment[]> {
  if (taskIds.length === 0) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("task_attachments")
    .select("*")
    .in("task_id", taskIds)
    .order("created_at", { ascending: false });
  return (data ?? []) as Attachment[];
}

// 방의 첨부 전체. 할 일 목록과 동시에 읽고, 보이는 할 일 것만 남기는 건 호출하는 쪽이 한다.
export async function loadProjectAttachments(projectId: string): Promise<Attachment[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("task_attachments")
    .select("*, tasks!inner()")
    .eq("tasks.project_id", projectId)
    .order("created_at", { ascending: false });
  return (data ?? []) as Attachment[];
}

export async function loadNotices(ctx: ProjectContext, view: string | undefined, limit?: number): Promise<Notice[]> {
  const supabase = await createClient();
  let q = supabase.from("notices").select("*").eq("project_id", ctx.project.id).order("created_at", { ascending: false });
  if (limit) q = q.limit(limit * 4);
  const { data } = await q;
  let notices = ((data ?? []) as Notice[]).filter((n) => canViewScope(ctx.scope, n.group_id));
  if (view) notices = notices.filter((n) => n.group_id === null || n.group_id === view);
  return limit ? notices.slice(0, limit) : notices;
}
