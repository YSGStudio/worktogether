import { requireTeacher } from "@/lib/auth";
import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteAttachment } from "@/actions/attachments";
import { deleteComment, deleteNotice } from "@/actions/notices";
import { deleteTask } from "@/actions/tasks";
import { ConfirmButton } from "@/components/ConfirmButton";
import { StatusToggle } from "@/components/StatusToggle";
import { BackLink, btn, Card, Empty, formatDateTime, formatRange, OverdueBadge, PageTitle, SectionTitle } from "@/components/ui";
import { isOverdue, todayKST } from "@/lib/domain/dates";
import { loadStudentWork } from "@/lib/studentWork";
import { createClient } from "@/lib/supabase/server";
import type { Topic } from "@/lib/types";

// 학생 한 명의 모든 작업을 주제별로 보고 고치거나 지운다(교사)
export default async function StudentWorkPage({ params }: PageProps<"/teacher/topics/[topicId]/students/[studentId]">) {
  await requireTeacher();
  const { topicId, studentId } = await params;
  const supabase = await createClient();
  const { data: student } = await supabase.from("profiles").select("id, name, class_id").eq("id", studentId).eq("role", "student").maybeSingle();
  if (!student) notFound();
  const { data: topicRows } = await supabase.from("topics").select("*").eq("class_id", student.class_id).order("start_date", { ascending: false });
  const topics = ((topicRows ?? []) as Topic[]).sort((a, b) => (a.id === topicId ? -1 : b.id === topicId ? 1 : 0));
  if (!topics.some((t) => t.id === topicId)) notFound();
  const works = await Promise.all(topics.map((t) => loadStudentWork(t.id, studentId)));
  const today = todayKST();
  const here = `/teacher/topics/${topicId}/students/${studentId}`;

  return (
    <>
      <BackLink href={`/teacher/topics/${topicId}/activity`}>학생별 활동 모아보기</BackLink>
      <PageTitle sub="주제별로 이 학생의 할 일, 올린 자료, 공지·댓글을 모았어요">{student.name} 학생의 작업</PageTitle>
      <div className="space-y-4">
        {topics.map((t, i) => {
          const w = works[i];
          return (
            <Card key={t.id}>
              <SectionTitle>
                {t.title} <span className="text-sm font-normal text-stone-500">{formatRange(t.start_date, t.end_date)}</span>
              </SectionTitle>
              <div className="grid gap-4 lg:grid-cols-2">
                <div>
                  <h3 className="mb-2 font-bold">배정된 할 일 {w.tasks.length}</h3>
                  {w.tasks.length === 0 ? (
                    <Empty>없어요</Empty>
                  ) : (
                    <ul className="space-y-2">
                      {w.tasks.map((task) => (
                        <li key={task.id} className="rounded-md border border-stone-200 p-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <Link href={`/p/${task.project_id}/tasks/${task.id}`} className="font-semibold text-blue-800 hover:underline">{task.title}</Link>
                            <span className="text-sm text-stone-600">{formatRange(task.start_date, task.due_date)}</span>
                            {isOverdue(task, today) && <OverdueBadge />}
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-2">
                            <StatusToggle taskId={task.id} status={task.status} canChange />
                            <Link href={`/p/${task.project_id}/tasks/${task.id}`} className={btn.small}>고치기</Link>
                            <ConfirmButton action={deleteTask.bind(null, task.id, here)} confirm={`"${task.title}" 할 일을 지울까요? 첨부도 함께 지워져요.`}>삭제</ConfirmButton>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div>
                  <h3 className="mb-2 font-bold">올린 자료 {w.uploads.length}</h3>
                  {w.uploads.length === 0 ? (
                    <Empty>없어요</Empty>
                  ) : (
                    <ul className="space-y-1" data-testid="student-uploads">
                      {w.uploads.map((a) => (
                        <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-stone-200 p-2 text-sm">
                          <span className="min-w-0">
                            <a href={a.href ?? "#"} target="_blank" rel="noopener noreferrer" className="font-semibold text-blue-800 hover:underline break-all">{a.file_name}</a>
                            <span className="text-stone-500"> · {a.taskTitle} · {formatDateTime(a.created_at)}</span>
                          </span>
                          <ConfirmButton action={deleteAttachment.bind(null, a.id)} confirm={`"${a.file_name}"을(를) 지울까요? 파일도 함께 지워져요.`}>삭제</ConfirmButton>
                        </li>
                      ))}
                    </ul>
                  )}
                  <h3 className="mt-4 mb-2 font-bold">쓴 공지 {w.notices.length} · 댓글 {w.comments.length}</h3>
                  <ul className="space-y-1 text-sm">
                    {w.notices.map((n) => (
                      <li key={n.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-stone-200 p-2">
                        <Link href={`/p/${n.project_id}/notices#notice-${n.id}`} className="font-semibold text-blue-800 hover:underline">[공지] {n.title}</Link>
                        <ConfirmButton action={deleteNotice.bind(null, n.id)} confirm="이 공지를 지울까요?">삭제</ConfirmButton>
                      </li>
                    ))}
                    {w.comments.map((c) => (
                      <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-stone-200 p-2">
                        <Link href={`/p/${c.projectId}/notices`} className="min-w-0 break-words hover:underline">[댓글] {c.body} <span className="text-stone-500">({c.noticeTitle})</span></Link>
                        <ConfirmButton action={deleteComment.bind(null, c.id)} confirm="이 댓글을 지울까요?">삭제</ConfirmButton>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </>
  );
}
