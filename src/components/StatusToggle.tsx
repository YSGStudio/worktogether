"use client";

import { useState, useTransition } from "react";
import { updateTaskStatus } from "@/actions/tasks";
import type { TaskStatus } from "@/lib/domain/dates";
import { STATUS_LABEL, STATUSES } from "@/lib/domain/status";

const ACTIVE = { todo: "bg-stone-600 text-white", doing: "bg-blue-600 text-white", done: "bg-green-600 text-white" } as const;

// 3단 상태 토글. 권한이 없으면 비활성(서버·DB에서도 다시 막는다).
export function StatusToggle({ taskId, status, canChange }: { taskId: string; status: TaskStatus; canChange: boolean }) {
  const [current, setCurrent] = useState(status);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div>
      <div role="radiogroup" aria-label="상태" className="inline-flex overflow-hidden rounded-lg border border-stone-300">
        {STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            role="radio"
            aria-checked={current === s}
            disabled={!canChange || pending}
            onClick={() =>
              start(async () => {
                const prev = current;
                setCurrent(s);
                setError(null);
                const res = await updateTaskStatus(taskId, s);
                if (!res.ok) {
                  setCurrent(prev);
                  setError(res.error);
                }
              })
            }
            className={`px-3 py-1.5 text-sm font-semibold whitespace-nowrap disabled:cursor-not-allowed ${
              current === s ? ACTIVE[s] : "bg-white text-stone-600"
            } ${!canChange ? "opacity-60" : "hover:opacity-90"}`}
          >
            {STATUS_LABEL[s]}
          </button>
        ))}
      </div>
      {error && <p className="mt-1 text-xs text-red-700">{error}</p>}
    </div>
  );
}
