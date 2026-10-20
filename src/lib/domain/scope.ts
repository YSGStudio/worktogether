// supabase 마이그레이션의 can_view_scope / can_edit_scope와 같은 규칙.
// UI에서 버튼을 보일지 정할 때 쓰고, 실제 차단은 RLS가 한다.
export type ScopeContext = {
  isTeacher: boolean; // 이 방의 교사
  isProjectLeader: boolean;
  isMember: boolean;
  myGroupId: string | null;
  isMyGroupLeader: boolean; // 내 모둠의 모둠장인지
};

export function canViewScope(ctx: ScopeContext, groupId: string | null): boolean {
  if (ctx.isTeacher || ctx.isProjectLeader) return true;
  if (!ctx.isMember) return false;
  return groupId === null || groupId === ctx.myGroupId;
}

export function canEditScope(ctx: ScopeContext, groupId: string | null): boolean {
  if (ctx.isTeacher || ctx.isProjectLeader) return true;
  return groupId !== null && groupId === ctx.myGroupId && ctx.isMyGroupLeader;
}

export function canChangeStatus(
  ctx: ScopeContext,
  task: { group_id: string | null; assignee_ids: string[] },
  userId: string,
): boolean {
  return task.assignee_ids.includes(userId) || canEditScope(ctx, task.group_id);
}

// 작업 공간 판단: 모둠 방이면 모둠별, 아니면 방 전체
export type RoomKind = "whole" | "grouped";

export function roomKind(groupCount: number): RoomKind {
  return groupCount > 0 ? "grouped" : "whole";
}
