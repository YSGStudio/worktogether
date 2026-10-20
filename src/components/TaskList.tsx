import Link from "next/link";
import { isOverdue } from "@/lib/domain/dates";
import type { Task } from "@/lib/types";
import { Empty, formatRange, OverdueBadge, StatusBadge } from "./ui";

export function TaskList({
  tasks,
  names,
  today,
  hrefFor,
  showScope,
}: {
  tasks: Task[];
  names: Record<string, string>;
  today: string;
  hrefFor: (t: Task) => string;
  showScope?: (t: Task) => string;
}) {
  if (tasks.length === 0) return <Empty>할 일이 없어요</Empty>;
  return (
    <ul className="divide-y divide-stone-100" data-testid="task-list">
      {tasks.map((t) => (
        <li key={t.id} className="flex flex-col gap-1 py-2 sm:flex-row sm:items-center sm:justify-between">
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
          <div className="flex shrink-0 gap-1">
            <StatusBadge status={t.status} />
            {isOverdue(t, today) && <OverdueBadge />}
          </div>
        </li>
      ))}
    </ul>
  );
}
