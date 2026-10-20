"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveAiDrafts } from "@/actions/tasks";
import type { AiDraft } from "@/lib/domain/ai";
import { btn, Field, input } from "./ui";

type Scope = { groupId: string | null; label: string };
type Row = AiDraft & { include: boolean };

// AI 초안은 미리보기로만 보여 주고, "추가"를 눌러야 저장된다(새로고침하면 사라진다).
export function AiTaskGenerator({ projectId, scopes, range }: { projectId: string; scopes: Scope[]; range: { start: string; end: string } }) {
  const router = useRouter();
  const [scopeIdx, setScopeIdx] = useState(0);
  const [instruction, setInstruction] = useState("");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [draftScope, setDraftScope] = useState<Scope | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, startSave] = useTransition();

  async function generate() {
    setLoading(true);
    setError(null);
    setMessage(null);
    const scope = scopes[scopeIdx];
    try {
      const res = await fetch(`/api/projects/${projectId}/ai-tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupId: scope.groupId, instruction }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error ?? "AI 할 일을 만들지 못했어요");
        return;
      }
      setRows((body.drafts as AiDraft[]).map((d) => ({ ...d, include: true })));
      setDraftScope(scope);
    } catch {
      setError("AI 할 일을 만들지 못했어요. 인터넷 연결을 확인하세요.");
    } finally {
      setLoading(false);
    }
  }

  function update(i: number, patch: Partial<Row>) {
    setRows((prev) => prev && prev.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  }

  function save() {
    if (!rows || !draftScope) return;
    const picked = rows
      .filter((r) => r.include)
      .map((r) => ({ title: r.title, description: r.description, start_date: r.start_date, due_date: r.due_date }));
    if (picked.length === 0) {
      setError("추가할 할 일을 1개 이상 고르세요");
      return;
    }
    startSave(async () => {
      const res = await saveAiDrafts(projectId, draftScope.groupId, picked);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setRows(null);
      setMessage(res.message ?? "추가했어요");
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-[200px_1fr]">
        {scopes.length > 1 ? (
          <Field label="어디에 만들까요">
            <select value={scopeIdx} onChange={(e) => setScopeIdx(Number(e.target.value))} className={input}>
              {scopes.map((s, i) => (
                <option key={s.groupId ?? "common"} value={i}>
                  {s.label}
                </option>
              ))}
            </select>
          </Field>
        ) : (
          <p className="text-sm text-stone-600 sm:col-span-1">작업 공간: {scopes[0]?.label}</p>
        )}
        <Field label="추가 지시 (선택)">
          <input value={instruction} maxLength={300} onChange={(e) => setInstruction(e.target.value)} placeholder="예: 발표 준비 포함" className={input} />
        </Field>
      </div>
      <button type="button" onClick={generate} disabled={loading || saving} className={btn.secondary}>
        {loading ? "AI가 할 일을 만드는 중…" : "AI로 할 일 만들기"}
      </button>
      <p className="text-xs text-stone-500">AI에는 주제·방 정보와 인원 수만 보내요. 학생 이름은 보내지 않아요.</p>
      {error && <p role="alert" className="text-sm font-medium text-red-700">{error}</p>}
      {message && <p className="text-sm font-medium text-green-700">{message}</p>}

      {rows && draftScope && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3" data-testid="ai-preview">
          <p className="mb-2 text-sm font-semibold text-blue-900">
            미리보기 ({draftScope.label}) — 고치거나 빼고 &quot;추가&quot;를 누르세요. 아직 저장되지 않았어요.
          </p>
          <ul className="space-y-2">
            {rows.map((r, i) => (
              <li key={i} className={`rounded-md border bg-white p-2 ${r.include ? "border-stone-200" : "border-dashed border-stone-300 opacity-60"}`}>
                <label className="mb-1 flex items-center gap-2 text-sm font-semibold">
                  <input type="checkbox" checked={r.include} onChange={(e) => update(i, { include: e.target.checked })} className="h-4 w-4" />
                  포함
                </label>
                <input value={r.title} maxLength={100} onChange={(e) => update(i, { title: e.target.value })} className={`${input} mb-1 font-semibold`} aria-label="제목" />
                <textarea value={r.description} rows={2} maxLength={500} onChange={(e) => update(i, { description: e.target.value })} className={`${input} mb-1 text-sm`} aria-label="설명" />
                <div className="grid grid-cols-2 gap-2">
                  <input type="date" value={r.start_date} min={range.start} max={range.end} onChange={(e) => update(i, { start_date: e.target.value })} className={input} aria-label="시작일" />
                  <input type="date" value={r.due_date} min={range.start} max={range.end} onChange={(e) => update(i, { due_date: e.target.value })} className={input} aria-label="마감일" />
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={save} disabled={saving} className={btn.primary}>
              {saving ? "추가하는 중…" : `${rows.filter((r) => r.include).length}개 추가`}
            </button>
            <button type="button" onClick={() => setRows(null)} className={btn.secondary}>
              취소
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
