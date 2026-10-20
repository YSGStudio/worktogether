import { ActionForm } from "@/components/ActionForm";
import { btn, Field, input } from "@/components/ui";
import type { ActionResult, Profile, Topic } from "@/lib/types";

export function TopicForm({
  action,
  students,
  topic,
  leaderIds = [],
  submitLabel,
}: {
  action: (prev: unknown, fd: FormData) => Promise<ActionResult>;
  students: Profile[];
  topic?: Topic;
  leaderIds?: string[];
  submitLabel: string;
}) {
  return (
    <ActionForm action={action} className="space-y-3">
      <Field label="주제 제목">
        <input name="title" required maxLength={100} defaultValue={topic?.title} className={input} placeholder="예: 우리 동네 환경 지도 만들기" />
      </Field>
      <Field label="전체 목표">
        <textarea name="goal" required maxLength={1000} rows={2} defaultValue={topic?.goal} className={input} />
      </Field>
      <Field label="설명 (선택)">
        <textarea name="description" rows={2} defaultValue={topic?.description ?? ""} className={input} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="시작일">
          <input type="date" name="start_date" required defaultValue={topic?.start_date} className={input} />
        </Field>
        <Field label="종료일">
          <input type="date" name="end_date" required defaultValue={topic?.end_date} className={input} />
        </Field>
      </div>
      <fieldset>
        <legend className="mb-1 text-sm font-semibold text-stone-700">팀장 (1명 이상, 팀장 1명이 방 1개를 이끌어요)</legend>
        {students.length === 0 ? (
          <p className="text-sm text-red-700">먼저 학급에 학생을 등록하세요.</p>
        ) : (
          <div className="grid grid-cols-2 gap-1 sm:grid-cols-3 md:grid-cols-4">
            {students.map((s) => (
              <label key={s.id} className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-stone-50">
                <input type="checkbox" name="leaders" value={s.id} defaultChecked={leaderIds.includes(s.id)} className="h-4 w-4" />
                <span className="truncate">{s.name}</span>
              </label>
            ))}
          </div>
        )}
      </fieldset>
      <button className={btn.primary}>{submitLabel}</button>
    </ActionForm>
  );
}
