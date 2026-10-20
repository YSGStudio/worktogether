import { createProject } from "@/actions/projects";
import { ActionForm } from "@/components/ActionForm";
import { btn, Field, input } from "@/components/ui";
import type { Topic } from "@/lib/types";

// 교사는 아직 방이 없는 팀장 중에서 여러 명(공동 팀장)을 고르고, 팀장 학생은 자기가 팀장이 된다.
export function RoomCreateForm({ topic, leaderChoices }: { topic: Topic; leaderChoices?: { id: string; name: string }[] }) {
  return (
    <ActionForm action={createProject.bind(null, topic.id)} className="space-y-3">
      <Field label="방 이름">
        <input name="name" required maxLength={50} className={input} placeholder="예: 하천 쓰레기 조사팀" />
      </Field>
      <Field label="설명 (선택)">
        <textarea name="description" rows={2} className={input} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="시작일" hint="주제 기간 안">
          <input type="date" name="start_date" defaultValue={topic.start_date} min={topic.start_date} max={topic.end_date} className={input} />
        </Field>
        <Field label="종료일">
          <input type="date" name="end_date" defaultValue={topic.end_date} min={topic.start_date} max={topic.end_date} className={input} />
        </Field>
      </div>
      {leaderChoices && <LeaderCheckboxes choices={leaderChoices} />}
      <button className={btn.primary}>방 만들기</button>
    </ActionForm>
  );
}

// 방 팀장 고르기(여러 명 가능). 아직 방이 없는 주제 팀장만 나온다.
export function LeaderCheckboxes({ choices, selected = [] }: { choices: { id: string; name: string }[]; selected?: string[] }) {
  return (
    <fieldset>
      <legend className="mb-1 text-sm font-semibold text-stone-700">방 팀장 (여러 명 고를 수 있어요. 나중에 정해도 돼요)</legend>
      {choices.length === 0 ? (
        <p className="text-sm text-stone-500">고를 수 있는 팀장이 없어요. 주제 정보에서 팀장을 더 지정하세요.</p>
      ) : (
        <div className="grid grid-cols-2 gap-1 sm:grid-cols-3">
          {choices.map((l) => (
            <label key={l.id} className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-stone-50">
              <input type="checkbox" name="leader_ids" value={l.id} defaultChecked={selected.includes(l.id)} className="h-4 w-4" />
              <span className="truncate">{l.name}</span>
            </label>
          ))}
        </div>
      )}
    </fieldset>
  );
}
