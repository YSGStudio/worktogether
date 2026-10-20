import "server-only";
import { createClient } from "@/lib/supabase/server";
import { signedUrls } from "@/lib/storage";
import { withAssignees } from "@/lib/assignees";
import type { Attachment, Notice, NoticeComment, Task } from "@/lib/types";

export type WorkAttachment = Attachment & { href: string | null; taskTitle: string; projectId: string };
export type StudentWork = {
  tasks: (Task & { attachments: WorkAttachment[] })[];
  uploads: WorkAttachment[]; // 이 학생이 올린 모든 첨부
  notices: Notice[];
  comments: (NoticeComment & { noticeTitle: string; projectId: string })[];
  timeline: { at: string; kind: "task" | "attachment" | "notice" | "comment"; id: string }[];
};

// 한 주제에서 한 학생이 한 일. 교사 세션으로 조회하므로 RLS가 교사 범위를 보장한다.
export async function loadStudentWork(topicId: string, studentId: string): Promise<StudentWork> {
  const supabase = await createClient();
  const { data: projects } = await supabase.from("projects").select("id").eq("topic_id", topicId);
  const ids = (projects ?? []).map((p) => p.id as string);
  if (ids.length === 0) return { tasks: [], uploads: [], notices: [], comments: [], timeline: [] };

  const [{ data: taskRows }, { data: uploadRows }, { data: noticeRows }, { data: commentRows }] = await Promise.all([
    supabase.from("task_assignees").select("task_id").in("project_id", ids).eq("student_id", studentId),
    supabase.from("task_attachments").select("*, tasks!inner(project_id, title)").in("tasks.project_id", ids).eq("uploaded_by", studentId),
    supabase.from("notices").select("*").in("project_id", ids).eq("author_id", studentId),
    supabase.from("notice_comments").select("*, notices!inner(project_id, title)").in("notices.project_id", ids).eq("author_id", studentId),
  ]);
  const assignedIds = (taskRows ?? []).map((r) => r.task_id as string);
  const { data: assignedTasks } = assignedIds.length
    ? await supabase.from("tasks").select("*").in("id", assignedIds).order("due_date")
    : { data: [] };
  const tasks = await withAssignees(supabase, (assignedTasks ?? []) as Task[]);
  const { data: taskAttRows } = tasks.length
    ? await supabase.from("task_attachments").select("*").in("task_id", tasks.map((t) => t.id))
    : { data: [] };

  const allAtt = [...((taskAttRows ?? []) as Attachment[]), ...((uploadRows ?? []) as Attachment[])];
  const urls = await signedUrls(supabase, [...new Set(allAtt.filter((a) => a.storage_path).map((a) => a.storage_path as string))]);
  const taskInfo = new Map(tasks.map((t) => [t.id, { title: t.title, projectId: t.project_id }]));
  const withHref = (a: Attachment & { tasks?: { project_id: string; title: string } }): WorkAttachment => ({
    ...a,
    href: a.kind === "link" ? a.url : urls[a.storage_path ?? ""] ?? null,
    taskTitle: a.tasks?.title ?? taskInfo.get(a.task_id)?.title ?? "",
    projectId: a.tasks?.project_id ?? taskInfo.get(a.task_id)?.projectId ?? "",
  });

  const uploads = ((uploadRows ?? []) as (Attachment & { tasks: { project_id: string; title: string } })[]).map(withHref);
  const notices = (noticeRows ?? []) as Notice[];
  const comments = ((commentRows ?? []) as (NoticeComment & { notices: { project_id: string; title: string } })[]).map((c) => ({
    ...c,
    noticeTitle: c.notices.title,
    projectId: c.notices.project_id,
  }));
  const timeline = [
    ...tasks.map((t) => ({ at: t.updated_at, kind: "task" as const, id: t.id })),
    ...uploads.map((a) => ({ at: a.created_at, kind: "attachment" as const, id: a.id })),
    ...notices.map((n) => ({ at: n.created_at, kind: "notice" as const, id: n.id })),
    ...comments.map((c) => ({ at: c.created_at, kind: "comment" as const, id: c.id })),
  ].sort((a, b) => (a.at < b.at ? -1 : 1));

  return {
    tasks: tasks.map((t) => ({ ...t, attachments: ((taskAttRows ?? []) as Attachment[]).filter((a) => a.task_id === t.id).map(withHref) })),
    uploads,
    notices,
    comments,
    timeline,
  };
}
