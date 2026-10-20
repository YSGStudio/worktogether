import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { roomKind, type RoomKind, type ScopeContext } from "@/lib/domain/scope";
import type { Group, Profile, Project, Topic } from "@/lib/types";

export type Member = { id: string; name: string };

export type ProjectContext = {
  me: Profile;
  project: Project;
  topic: Topic;
  groups: Group[];
  members: Member[];
  groupOf: Record<string, string>; // student_id → group_id
  scope: ScopeContext;
  kind: RoomKind;
  myGroup: Group | null;
  leaderIds: string[]; // 공동 팀장
  leaderNames: string[];
};

// 방 화면 공통 데이터. RLS가 막으면 404.
export const loadProject = cache(async (projectId: string): Promise<ProjectContext> => {
  const supabase = await createClient();
  // 모두 projectId만 있으면 되므로 한 번에 보낸다. 방을 볼 수 없으면 RLS가 전부 비운다.
  const [me, { data: projectRow }, { data: groups }, { data: memberRows }, { data: groupMemberRows }, { data: leaderRows }] = await Promise.all([
    requireUser(),
    supabase.from("projects").select("*, topics(*)").eq("id", projectId).maybeSingle(),
    supabase.from("groups").select("*").eq("project_id", projectId).order("created_at"),
    supabase.from("project_members").select("student_id, profiles(id, name)").eq("project_id", projectId),
    supabase.from("group_members").select("group_id, student_id").eq("project_id", projectId),
    supabase.from("project_leaders").select("student_id").eq("project_id", projectId),
  ]);
  if (!projectRow) notFound();
  const { topics: topic, ...project } = projectRow as Project & { topics: Topic | null };
  if (!topic) notFound();
  const leaderIds = (leaderRows ?? []).map((r) => r.student_id as string);

  const members: Member[] = (memberRows ?? [])
    .map((r) => {
      const p = r.profiles as unknown as Member | null;
      return { id: r.student_id as string, name: p?.name ?? "(알 수 없음)" };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "ko"));

  const groupOf: Record<string, string> = {};
  for (const gm of groupMemberRows ?? []) groupOf[gm.student_id] = gm.group_id;

  const groupList = (groups ?? []) as Group[];
  const myGroupId = groupOf[me.id] ?? null;
  const myGroup = groupList.find((g) => g.id === myGroupId) ?? null;
  const isTeacher = me.role === "teacher" && topic.teacher_id === me.id;

  const scope: ScopeContext = {
    isTeacher,
    isProjectLeader: leaderIds.includes(me.id),
    isMember: members.some((m) => m.id === me.id),
    myGroupId,
    isMyGroupLeader: myGroup?.leader_id === me.id,
  };

  return {
    me,
    project: project as Project,
    topic: topic as Topic,
    groups: groupList,
    members,
    groupOf,
    scope,
    kind: roomKind(groupList.length),
    myGroup,
    leaderIds,
    leaderNames: members.filter((m) => leaderIds.includes(m.id)).map((m) => m.name),
  };
});

// 할 일의 작업 공간 구성원(담당자 드롭다운): 모둠 할 일 → 그 모둠원, 방 공통·전체 방 → 방 구성원 전체
export function workspaceMembers(ctx: ProjectContext, groupId: string | null): Member[] {
  if (!groupId) return ctx.members;
  return ctx.members.filter((m) => ctx.groupOf[m.id] === groupId);
}

export function nameMap(ctx: ProjectContext): Record<string, string> {
  return { [ctx.topic.teacher_id]: "선생님", ...Object.fromEntries(ctx.members.map((m) => [m.id, m.name])) };
}

export function scopeLabel(ctx: ProjectContext, groupId: string | null): string {
  if (!groupId) return ctx.kind === "grouped" ? "방 공통" : "방 전체";
  return ctx.groups.find((g) => g.id === groupId)?.name ?? "모둠";
}

// 팀장·교사가 고른 보기(탭)에 맞는 모둠 필터. undefined = 전부.
export function resolveView(ctx: ProjectContext, view: string | undefined): string | undefined {
  const canSeeAll = ctx.scope.isTeacher || ctx.scope.isProjectLeader;
  if (!canSeeAll || ctx.kind === "whole") return undefined;
  if (view && ctx.groups.some((g) => g.id === view)) return view;
  return undefined;
}

// 내가 할 일·공지를 쓸 수 있는 작업 공간 목록(담당자 후보 포함)
export function editableScopes(ctx: ProjectContext): { groupId: string | null; label: string; members: Member[] }[] {
  if (ctx.scope.isTeacher || ctx.scope.isProjectLeader) {
    if (ctx.kind === "whole") return [{ groupId: null, label: "방 전체", members: ctx.members }];
    return [
      { groupId: null, label: "방 공통", members: ctx.members },
      ...ctx.groups.map((g) => ({ groupId: g.id, label: g.name, members: workspaceMembers(ctx, g.id) })),
    ];
  }
  if (ctx.scope.isMyGroupLeader && ctx.myGroup) {
    return [{ groupId: ctx.myGroup.id, label: ctx.myGroup.name, members: workspaceMembers(ctx, ctx.myGroup.id) }];
  }
  return [];
}
