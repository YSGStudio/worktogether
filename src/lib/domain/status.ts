import type { TaskStatus } from "./dates";

export const STATUS_LABEL: Record<TaskStatus, string> = {
  todo: "작업 전",
  doing: "작업 중",
  done: "작업 완료",
};

export const STATUSES: TaskStatus[] = ["todo", "doing", "done"];

export function isTaskStatus(s: unknown): s is TaskStatus {
  return s === "todo" || s === "doing" || s === "done";
}

export const ROLE_LABEL = {
  leader: "팀장",
  group_leader: "모둠장",
  member: "구성원",
} as const;
