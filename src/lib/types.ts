import type { TaskStatus } from "./domain/dates";

export type Role = "teacher" | "student";

export type Profile = { id: string; role: Role; name: string; class_id: string | null };

export type ClassRow = { id: string; teacher_id: string; name: string; code: string; created_at: string };

export type Topic = {
  id: string;
  class_id: string;
  teacher_id: string;
  title: string;
  goal: string;
  description: string | null;
  start_date: string;
  end_date: string;
  created_at: string;
};

export type Project = {
  id: string;
  topic_id: string;
  name: string;
  description: string | null;
  start_date: string;
  end_date: string;
  created_by: string | null;
  created_at: string;
};

export type Group = { id: string; project_id: string; name: string; leader_id: string | null; created_at: string };

export type Task = {
  id: string;
  project_id: string;
  group_id: string | null;
  title: string;
  description: string | null;
  start_date: string | null;
  due_date: string | null;
  assignee_ids: string[]; // task_assignees에서 채운다
  status: TaskStatus;
  ai_generated: boolean;
  sort_order: number;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type Attachment = {
  id: string;
  task_id: string;
  kind: "pdf" | "image" | "link" | "text";
  storage_path: string | null;
  url: string | null;
  body: string | null; // 글 결과물 본문(kind = "text")
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  uploaded_by: string | null;
  created_at: string;
};

export type Notice = {
  id: string;
  project_id: string;
  group_id: string | null;
  author_id: string | null;
  title: string;
  body: string;
  created_at: string;
  updated_at: string;
};

export type NoticeComment = {
  id: string;
  notice_id: string;
  author_id: string | null;
  body: string;
  created_at: string;
  updated_at: string;
};

export type ActionResult<T = undefined> = { ok: true; data?: T; message?: string } | { ok: false; error: string };

export type ActivityRow = {
  student_id: string;
  student_name: string;
  project_id: string;
  project_name: string;
  group_id: string | null;
  group_name: string | null;
  is_group_room: boolean;
  member_role: "leader" | "group_leader" | "member";
  task_count: number;
  todo_count: number;
  doing_count: number;
  done_count: number;
  overdue_count: number;
  attachment_count: number;
  notice_count: number;
  comment_count: number;
  last_activity_at: string | null;
};
