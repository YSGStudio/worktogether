"use client";

import { useState, useTransition } from "react";
import type { ActionResult } from "@/lib/types";
import { btn } from "./ui";

type Props = {
  action: () => Promise<ActionResult>;
  confirm?: string;
  children: React.ReactNode;
  className?: string;
};

// 삭제처럼 되돌릴 수 없는 일은 확인 창을 띄운 뒤 실행한다.
export function ConfirmButton({ action, confirm, children, className = btn.danger }: Props) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  return (
    <span className="inline-flex flex-col">
      <button
        type="button"
        className={className}
        disabled={pending}
        onClick={() => {
          if (confirm && !window.confirm(confirm)) return;
          start(async () => {
            try {
              setResult(await action());
            } catch (e) {
              // redirect()는 예외로 전달된다
              if (e && typeof e === "object" && "digest" in e) throw e;
              setResult({ ok: false, error: "처리하지 못했어요" });
            }
          });
        }}
      >
        {pending ? "처리 중…" : children}
      </button>
      {result && !result.ok && <span className="mt-1 text-xs text-red-700">{result.error}</span>}
      {result?.ok && result.message && <span className="mt-1 text-xs text-green-700">{result.message}</span>}
    </span>
  );
}
