"use client";

import Link from "next/link";
import { Fragment, useMemo, useState } from "react";
import { getStudentTopicWork } from "@/actions/activity";
import { StudentWorkTimeline } from "@/components/StudentWorkView";
import { formatDateTime } from "@/components/ui";
import { ROLE_LABEL } from "@/lib/domain/status";
import type { StudentWork } from "@/lib/studentWork";
import type { ActivityRow } from "@/lib/types";

type SortKey = "name" | "done" | "overdue" | "last";

export function groupLabel(r: ActivityRow): string {
  if (r.group_name) return r.group_name;
  return r.is_group_room ? "미배치" : "-";
}

// 학생별 활동 표: 방·모둠으로 거르고 이름·완료 수·기한 지남 수·마지막 활동으로 정렬, 행을 펼치면 시간순 활동
export function ActivityTable({ topicId, rows }: { topicId: string; rows: ActivityRow[] }) {
  const [room, setRoom] = useState("");
  const [group, setGroup] = useState("");
  const [sort, setSort] = useState<SortKey>("name");
  const [open, setOpen] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, StudentWork | string>>({});

  const rooms = useMemo(() => [...new Map(rows.map((r) => [r.project_id, r.project_name]))], [rows]);
  const groups = useMemo(
    () => [...new Map(rows.filter((r) => (!room || r.project_id === room) && r.group_id).map((r) => [r.group_id as string, `${r.project_name} · ${r.group_name}`]))],
    [rows, room],
  );

  const shown = useMemo(() => {
    const list = rows.filter((r) => (!room || r.project_id === room) && (!group || r.group_id === group));
    const cmp: Record<SortKey, (a: ActivityRow, b: ActivityRow) => number> = {
      name: (a, b) => a.student_name.localeCompare(b.student_name, "ko"),
      done: (a, b) => b.done_count - a.done_count,
      overdue: (a, b) => b.overdue_count - a.overdue_count,
      last: (a, b) => (b.last_activity_at ?? "").localeCompare(a.last_activity_at ?? ""),
    };
    return [...list].sort(cmp[sort]);
  }, [rows, room, group, sort]);

  async function toggle(studentId: string) {
    if (open === studentId) return setOpen(null);
    setOpen(studentId);
    if (!details[studentId]) {
      const res = await getStudentTopicWork(topicId, studentId);
      setDetails((d) => ({ ...d, [studentId]: res.ok && res.data ? res.data : res.ok ? "불러오지 못했어요" : res.error }));
    }
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-end gap-2 text-sm">
        <label>
          <span className="mr-1 font-semibold">방</span>
          <select value={room} onChange={(e) => { setRoom(e.target.value); setGroup(""); }} className="rounded-md border border-stone-300 px-2 py-1" aria-label="방 필터">
            <option value="">전체</option>
            {rooms.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
        </label>
        <label>
          <span className="mr-1 font-semibold">모둠</span>
          <select value={group} onChange={(e) => setGroup(e.target.value)} className="rounded-md border border-stone-300 px-2 py-1" aria-label="모둠 필터">
            <option value="">전체</option>
            {groups.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
        </label>
        <label>
          <span className="mr-1 font-semibold">정렬</span>
          <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="rounded-md border border-stone-300 px-2 py-1" aria-label="정렬">
            <option value="name">이름</option>
            <option value="done">완료 많은 순</option>
            <option value="overdue">기한 지남 많은 순</option>
            <option value="last">최근 활동 순</option>
          </select>
        </label>
      </div>
      <div className="overflow-x-auto rounded-lg border border-stone-200">
        <table className="w-full min-w-[900px] text-left text-sm" data-testid="activity-table">
          <thead className="bg-stone-50 text-xs text-stone-600">
            <tr>
              <th className="px-2 py-2">이름</th>
              <th className="px-2 py-2">방</th>
              <th className="px-2 py-2">모둠</th>
              <th className="px-2 py-2">역할</th>
              <th className="px-2 py-2 text-right">할 일</th>
              <th className="px-2 py-2 text-right">작업 전/중/완료</th>
              <th className="px-2 py-2 text-right">기한 지남</th>
              <th className="px-2 py-2 text-right">자료</th>
              <th className="px-2 py-2 text-right">공지·댓글</th>
              <th className="px-2 py-2">마지막 활동</th>
              <th className="px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => {
              const d = details[r.student_id];
              return (
                <Fragment key={r.student_id}>
                  <tr className="border-t border-stone-100" data-testid="activity-row">
                    <td className="px-2 py-2 font-semibold">
                      <Link href={`/teacher/topics/${topicId}/students/${r.student_id}`} className="text-blue-800 hover:underline">{r.student_name}</Link>
                    </td>
                    <td className="px-2 py-2">{r.project_name}</td>
                    <td className="px-2 py-2">{groupLabel(r)}</td>
                    <td className="px-2 py-2">{ROLE_LABEL[r.member_role]}</td>
                    <td className="px-2 py-2 text-right">{r.task_count}</td>
                    <td className="px-2 py-2 text-right">{r.todo_count}/{r.doing_count}/{r.done_count}</td>
                    <td className={`px-2 py-2 text-right ${r.overdue_count ? "font-bold text-red-700" : ""}`}>{r.overdue_count}</td>
                    <td className="px-2 py-2 text-right">{r.attachment_count}</td>
                    <td className="px-2 py-2 text-right">{r.notice_count + r.comment_count}</td>
                    <td className="px-2 py-2 whitespace-nowrap">{formatDateTime(r.last_activity_at)}</td>
                    <td className="px-2 py-2">
                      <button type="button" onClick={() => toggle(r.student_id)} className="rounded border border-stone-300 px-2 py-0.5 text-xs" aria-expanded={open === r.student_id}>
                        {open === r.student_id ? "접기" : "펼치기"}
                      </button>
                    </td>
                  </tr>
                  {open === r.student_id && (
                    <tr>
                      <td colSpan={11} className="bg-stone-50 px-3 py-3">
                        {!d ? <p className="text-sm text-stone-500">불러오는 중…</p> : typeof d === "string" ? <p className="text-sm text-red-700">{d}</p> : <StudentWorkTimeline work={d} />}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
