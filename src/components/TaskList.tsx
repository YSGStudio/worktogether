import Link from "next/link";
import { isOverdue } from "@/lib/domain/dates";
import type { Task } from "@/lib/types";
import { Empty, formatRange, OverdueBadge, StatusBadge } from "./ui";

export const TASK_GRID = "grid grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] gap-3";
export const TASK_TILE = "flex min-w-0 flex-col justify-between gap-2 rounded-xl border border-stone-200 bg-white p-3";

export function TaskList({
  tasks,
  names,
  today,
  hrefFor,
  showScope,
  grid,
}: {
  tasks: Task[];
  names: Record<string, string>;
  today: string;
  hrefFor: (t: Task) => string;
  showScope?: (t: Task) => string;
  grid?: boolean;
}) {
  if (tasks.length === 0) return <Empty>할 일이 없어요</Empty>;
  // grid: 화면 너비에 맞춰 칸 수가 늘어나는 카드 격자(학생 화면), 아니면 한 줄씩
  return (
    <ul className={grid ? TASK_GRID : "divide-y divide-stone-100"} data-testid="task-list">
      {tasks.map((t) => (
        <li key={t.id} className={grid ? TASK_TILE : "flex flex-col gap-1 py-2 sm:flex-row sm:items-center sm:justify-between"}>
          <div className="min-w-0">
            <Link href={hrefFor(t)} className="font-semibold text-blue-800 hover:underline break-words">
              {t.title}
            </Link>
            {t.ai_generated && <span className="ml-1 text-xs text-stone-400">AI</span>}
            <p className="text-sm text-stone-600">
              {t.assignee_ids.length ? t.assignee_ids.map((id) => names[id] ?? "?").join(", ") : "미배정"} · {formatRange(t.start_date, t.due_date)}
              {showScope && ` · ${showScope(t)}`}
            </p>
          </div>
          <div className={`flex gap-1 ${grid ? "flex-wrap" : "shrink-0"}`}>
            <StatusBadge status={t.status} />
            {isOverdue(t, today) && <OverdueBadge />}
          </div>
        </li>
      ))}
    </ul>
  );
}
