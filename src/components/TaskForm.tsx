"use client";

import { useState } from "react";
import { ActionForm } from "./ActionForm";
import { btn, Field, input } from "./ui";
import { STATUS_LABEL, STATUSES } from "@/lib/domain/status";
import type { ActionResult, Task } from "@/lib/types";

export type ScopeOption = { groupId: string | null; label: string; members: { id: string; name: string }[] };

// 할 일 추가·수정. 담당자는 여러 명 고를 수 있고, 소속(방 공통/모둠)을 바꾸면 그 작업 공간 구성원만 보인다.
export function TaskForm({
  action,
  scopes,
  task,
  range,
  submitLabel,
}: {
  action: (prev: unknown, fd: FormData) => Promise<ActionResult>;
  scopes: ScopeOption[];
  task?: Task;
  range: { start: string; end: string };
  submitLabel: string;
}) {
  const initial = task ? scopes.findIndex((s) => s.groupId === task.group_id) : 0;
  const [scopeIdx, setScopeIdx] = useState(Math.max(0, initial));
  const scope = scopes[scopeIdx];
  const initialAssignees = new Set(task?.assignee_ids ?? []);
  return (
    <ActionForm action={action} resetOnSuccess={!task} className="space-y-3">
      <Field label="제목">
        <input name="title" required maxLength={100} defaultValue={task?.title} className={input} />
      </Field>
      <Field label="설명 (선택)">
        <textarea name="description" rows={2} maxLength={1000} defaultValue={task?.description ?? ""} className={input} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="시작일 (선택)">
          <input type="date" name="start_date" min={range.start} max={range.end} defaultValue={task?.start_date ?? ""} className={input} />
        </Field>
        <Field label="마감일 (선택)">
          <input type="date" name="due_date" min={range.start} max={range.end} defaultValue={task?.due_date ?? ""} className={input} />
        </Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {scopes.length > 1 ? (
          <Field label="소속">
            <select name="group_id" value={scope.groupId ?? ""} onChange={(e) => setScopeIdx(scopes.findIndex((s) => (s.groupId ?? "") === e.target.value))} className={input}>
              {scopes.map((s) => (
                <option key={s.groupId ?? "common"} value={s.groupId ?? ""}>
                  {s.label}
                </option>
              ))}
            </select>
          </Field>
        ) : (
          <input type="hidden" name="group_id" value={scope.groupId ?? ""} />
        )}
        <Field label="상태">
          <select name="status" defaultValue={task?.status ?? "todo"} className={input}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <fieldset key={scopeIdx} data-testid="assignee-options">
        <legend className="mb-1 text-sm font-semibold text-stone-700">담당자 (여러 명 고를 수 있어요. 아무도 고르지 않으면 미배정)</legend>
        {scope.members.length === 0 ? (
          <p className="text-sm text-stone-500">이 작업 공간에 학생이 없어요</p>
        ) : (
          <div className="grid grid-cols-2 gap-1 sm:grid-cols-3">
            {scope.members.map((m) => (
              <label key={m.id} className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-stone-50">
                <input type="checkbox" name="assignee_ids" value={m.id} defaultChecked={initialAssignees.has(m.id)} className="h-4 w-4" />
                <span className="truncate">{m.name}</span>
              </label>
            ))}
          </div>
        )}
      </fieldset>
      <button className={btn.primary}>{submitLabel}</button>
    </ActionForm>
  );
}
