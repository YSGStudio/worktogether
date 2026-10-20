import Link from "next/link";
import type { ProjectContext } from "@/lib/project";

// 방 팀장·교사용 모둠 방 보기 전환: 방 전체 / 1모둠 / 2모둠 …
export function GroupTabs({ ctx, basePath, view }: { ctx: ProjectContext; basePath: string; view: string | undefined }) {
  if (ctx.kind !== "grouped" || !(ctx.scope.isTeacher || ctx.scope.isProjectLeader)) return null;
  const tabs = [{ id: undefined as string | undefined, name: "방 전체" }, ...ctx.groups.map((g) => ({ id: g.id, name: g.name }))];
  return (
    <div role="tablist" aria-label="모둠 보기" className="mb-4 flex gap-1 overflow-x-auto">
      {tabs.map((t) => {
        const active = t.id === view;
        return (
          <Link
            key={t.id ?? "all"}
            role="tab"
            aria-selected={active}
            href={t.id ? `${basePath}?view=${t.id}` : basePath}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold whitespace-nowrap ${
              active ? "bg-blue-600 text-white" : "border border-stone-300 bg-white text-stone-700 hover:bg-stone-50"
            }`}
          >
            {t.name}
          </Link>
        );
      })}
    </div>
  );
}

export function UnassignedNotice() {
  return (
    <p className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 font-medium text-amber-900">
      아직 모둠이 정해지지 않았어요. 선생님이 모둠을 정해 주면 모둠 할 일을 볼 수 있어요. 지금은 방 공통 항목만 보여요.
    </p>
  );
}
