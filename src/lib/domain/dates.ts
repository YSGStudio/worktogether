// 날짜는 모두 'YYYY-MM-DD' 문자열(한국 날짜)로 다룬다.
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isDateString(s: string | null | undefined): s is string {
  if (!s || !DATE_RE.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

export function todayKST(now: Date = new Date()): string {
  return new Date(now.getTime() + 9 * 3600_000).toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

export function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}

export type RangeError = string | null;

export function validateRange(start: string, end: string): RangeError {
  if (!isDateString(start) || !isDateString(end)) return "날짜를 바르게 입력하세요";
  if (end < start) return "끝나는 날은 시작하는 날과 같거나 뒤여야 해요";
  return null;
}

// 방 기간 ⊂ 주제 기간
export function validateRangeWithin(
  start: string,
  end: string,
  outer: { start: string; end: string },
): RangeError {
  const base = validateRange(start, end);
  if (base) return base;
  if (start < outer.start || end > outer.end) {
    return `기간은 ${outer.start} ~ ${outer.end} 안이어야 해요`;
  }
  return null;
}

// 할 일 날짜(선택)가 방 기간 안인지
export function validateTaskDates(
  start: string | null,
  due: string | null,
  room: { start: string; end: string },
): RangeError {
  for (const d of [start, due]) {
    if (d === null) continue;
    if (!isDateString(d)) return "날짜를 바르게 입력하세요";
    if (d < room.start || d > room.end) return `날짜는 방 기간(${room.start} ~ ${room.end}) 안이어야 해요`;
  }
  if (start && due && due < start) return "마감일은 시작일과 같거나 뒤여야 해요";
  return null;
}

export type TaskStatus = "todo" | "doing" | "done";

export function isOverdue(task: { status: TaskStatus; due_date: string | null }, today: string): boolean {
  return task.status !== "done" && task.due_date !== null && task.due_date < today;
}

// 내 할 일: 마감일 순(날짜 없는 것은 맨 뒤)
export function sortByDueDate<T extends { due_date: string | null; title: string }>(tasks: T[]): T[] {
  return [...tasks].sort((a, b) => {
    if (a.due_date === b.due_date) return a.title.localeCompare(b.title, "ko");
    if (a.due_date === null) return 1;
    if (b.due_date === null) return -1;
    return a.due_date < b.due_date ? -1 : 1;
  });
}
