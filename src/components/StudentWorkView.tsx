import Link from "next/link";
import type { StudentWork } from "@/lib/studentWork";
import { formatDateTime, formatRange, StatusBadge } from "./ui";

// 학생이 한 일을 시간순으로 보여준다(활동 표 펼침, 학생 작업 화면 공용)
export function StudentWorkTimeline({ work }: { work: StudentWork }) {
  const tasks = new Map(work.tasks.map((t) => [t.id, t]));
  const uploads = new Map(work.uploads.map((a) => [a.id, a]));
  const notices = new Map(work.notices.map((n) => [n.id, n]));
  const comments = new Map(work.comments.map((c) => [c.id, c]));
  if (work.timeline.length === 0) return <p className="text-sm text-stone-500">이 주제에서 한 일이 아직 없어요</p>;
  return (
    <ol className="space-y-2 text-sm" data-testid="student-work-timeline">
      {work.timeline.map((e) => {
        if (e.kind === "task") {
          const t = tasks.get(e.id)!;
          return (
            <li key={`t-${e.id}`} className="rounded-md bg-white p-2">
              <span className="mr-1 text-xs text-stone-500">{formatDateTime(e.at)} · 할 일</span>
              <Link href={`/p/${t.project_id}/tasks/${t.id}`} className="font-semibold text-blue-800 hover:underline">{t.title}</Link>{" "}
              <span className="text-stone-600">{formatRange(t.start_date, t.due_date)}</span> <StatusBadge status={t.status} />
              {t.attachments.length > 0 && (
                <ul className="mt-1 ml-3 list-disc">
                  {t.attachments.map((a) => (
                    <li key={a.id}>
                      <a href={a.href ?? "#"} target="_blank" rel="noopener noreferrer" className="text-blue-700 hover:underline">{a.file_name}</a>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        }
        if (e.kind === "attachment") {
          const a = uploads.get(e.id)!;
          return (
            <li key={`a-${e.id}`} className="rounded-md bg-white p-2">
              <span className="mr-1 text-xs text-stone-500">{formatDateTime(e.at)} · 자료</span>
              <a href={a.href ?? "#"} target="_blank" rel="noopener noreferrer" className="font-semibold text-blue-800 hover:underline">{a.file_name}</a>
              <span className="text-stone-600"> ({a.taskTitle})</span>
            </li>
          );
        }
        if (e.kind === "notice") {
          const n = notices.get(e.id)!;
          return (
            <li key={`n-${e.id}`} className="rounded-md bg-white p-2">
              <span className="mr-1 text-xs text-stone-500">{formatDateTime(e.at)} · 공지</span>
              <Link href={`/p/${n.project_id}/notices#notice-${n.id}`} className="font-semibold text-blue-800 hover:underline">{n.title}</Link>
            </li>
          );
        }
        const c = comments.get(e.id)!;
        return (
          <li key={`c-${e.id}`} className="rounded-md bg-white p-2">
            <span className="mr-1 text-xs text-stone-500">{formatDateTime(e.at)} · 댓글</span>
            <span className="break-words">{c.body}</span>
            <span className="text-stone-600"> (공지: {c.noticeTitle})</span>
          </li>
        );
      })}
    </ol>
  );
}
