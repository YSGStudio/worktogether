import Link from "next/link";
import { axisTicks, computeBar, todayPosition } from "@/lib/domain/timeline";
import { daysBetween, isOverdue } from "@/lib/domain/dates";
import { STATUS_LABEL } from "@/lib/domain/status";
import type { Task } from "@/lib/types";
import { formatDate, formatRange } from "./ui";

export type TimelineTask = Pick<Task, "id" | "title" | "start_date" | "due_date" | "status"> & { assigneeName: string | null };
export type TimelineSection = { key: string; title: string; tasks: TimelineTask[] };

const BAR_COLOR = { todo: "bg-stone-400", doing: "bg-blue-500", done: "bg-green-500" } as const;
const LABEL_W = "9rem";

// 흐름도: 가로축은 방 기간, 세로는 할 일. 외부 간트 라이브러리 없이 절대 위치로 그린다.
export function Timeline({
  rangeStart,
  rangeEnd,
  today,
  sections,
  taskHref,
}: {
  rangeStart: string;
  rangeEnd: string;
  today: string;
  sections: TimelineSection[];
  taskHref: (id: string) => string;
}) {
  const days = daysBetween(rangeStart, rangeEnd) + 1;
  const ticks = axisTicks(rangeStart, rangeEnd, 10);
  const todayPct = todayPosition(rangeStart, rangeEnd, today);
  const undated = sections.flatMap((s) => s.tasks.filter((t) => !t.start_date && !t.due_date).map((t) => ({ ...t, section: s.title })));
  const visibleSections = sections
    .map((s) => ({ ...s, tasks: s.tasks.filter((t) => t.start_date || t.due_date) }))
    .filter((s) => s.tasks.length > 0 || sections.length > 1);

  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-3 text-xs text-stone-600" aria-label="범례">
        <Legend className="bg-stone-400">{STATUS_LABEL.todo}</Legend>
        <Legend className="bg-blue-500">{STATUS_LABEL.doing}</Legend>
        <Legend className="bg-green-500">{STATUS_LABEL.done}</Legend>
        <Legend className="bg-white ring-2 ring-red-500">기한 지남</Legend>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-3 w-0.5 bg-red-500" /> 오늘
        </span>
      </div>
      <div className="overflow-x-auto rounded-lg border border-stone-200" data-testid="timeline-scroll">
        <div className="relative" style={{ minWidth: `calc(${LABEL_W} + ${Math.max(480, days * 26)}px)` }}>
          <div className="flex border-b border-stone-200 bg-stone-50 text-xs text-stone-600">
            <div className="shrink-0 px-2 py-1 font-semibold" style={{ width: LABEL_W }}>
              할 일
            </div>
            <div className="relative h-6 flex-1" data-testid="timeline-axis">
              {ticks.map((t) => (
                <span key={t.date} className="absolute top-1 -translate-x-0 pl-0.5" style={{ left: `${t.pct}%` }}>
                  {formatDate(t.date)}
                </span>
              ))}
            </div>
          </div>

          {visibleSections.map((s) => (
            <div key={s.key} data-testid={`timeline-section-${s.key}`}>
              {sections.length > 1 && (
                <div className="border-b border-stone-200 bg-stone-100 px-2 py-1 text-sm font-bold text-stone-700">{s.title}</div>
              )}
              {s.tasks.length === 0 && <div className="border-b border-stone-100 px-2 py-2 text-xs text-stone-500">할 일이 없어요</div>}
              {s.tasks.map((t) => {
                const bar = computeBar(rangeStart, rangeEnd, t.start_date, t.due_date);
                const overdue = isOverdue(t, today);
                return (
                  <div key={t.id} className="flex border-b border-stone-100">
                    <Link
                      href={taskHref(t.id)}
                      className="shrink-0 truncate px-2 py-2 text-sm hover:underline"
                      style={{ width: LABEL_W }}
                      title={t.title}
                    >
                      {t.title}
                    </Link>
                    <div className="relative h-9 flex-1">
                      {bar && (
                        <Link
                          href={taskHref(t.id)}
                          data-testid="timeline-bar"
                          data-status={t.status}
                          data-overdue={overdue ? "true" : "false"}
                          className={`absolute top-1.5 flex h-6 items-center overflow-hidden rounded px-1.5 text-xs font-semibold whitespace-nowrap text-white ${BAR_COLOR[t.status]} ${overdue ? "ring-2 ring-red-500 ring-offset-1" : ""}`}
                          style={{ left: `${bar.leftPct}%`, width: `${bar.widthPct}%`, minWidth: "1.25rem" }}
                          title={`${t.title} · ${t.assigneeName ?? "미배정"} · ${formatRange(t.start_date, t.due_date)} · ${STATUS_LABEL[t.status]}${overdue ? " · 기한 지남" : ""}`}
                        >
                          {t.assigneeName ?? "미배정"}
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}

          {todayPct !== null && (
            <div
              data-testid="timeline-today"
              className="pointer-events-none absolute top-0 bottom-0 w-0.5 bg-red-500/80"
              style={{ left: `calc(${LABEL_W} + (100% - ${LABEL_W}) * ${todayPct / 100})` }}
              aria-label="오늘"
            />
          )}
        </div>
      </div>

      <div className="mt-3" data-testid="timeline-undated">
        <h3 className="mb-1 text-sm font-bold text-stone-700">날짜 미정</h3>
        {undated.length === 0 ? (
          <p className="text-sm text-stone-500">날짜가 없는 할 일이 없어요</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {undated.map((t) => (
              <li key={t.id}>
                <Link href={taskHref(t.id)} className="inline-flex items-center gap-1 rounded-full border border-stone-300 bg-white px-3 py-1 text-sm hover:bg-stone-50">
                  <span className={`inline-block h-2 w-2 rounded-full ${BAR_COLOR[t.status]}`} />
                  {t.title}
                  <span className="text-stone-500">· {t.assigneeName ?? "미배정"}</span>
                  {sections.length > 1 && <span className="text-xs text-stone-400">({t.section})</span>}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Legend({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className={`inline-block h-3 w-4 rounded-sm ${className}`} />
      {children}
    </span>
  );
}
