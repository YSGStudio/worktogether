"use client";

import { useEffect, useRef, useState } from "react";
import { MAX_LINKS } from "@/lib/domain/upload";
import { btn, input } from "./ui";

// 링크 입력 칸을 여러 줄로 늘린다. 폼이 초기화되면 한 줄로 돌아간다.
export function LinkRows() {
  const ref = useRef<HTMLDivElement>(null);
  const [rows, setRows] = useState([0]);
  const next = useRef(1);

  useEffect(() => {
    const form = ref.current?.closest("form");
    if (!form) return;
    const reset = () => setRows([next.current++]);
    form.addEventListener("reset", reset);
    return () => form.removeEventListener("reset", reset);
  }, []);

  return (
    <div ref={ref} className="space-y-3">
      {rows.map((id, i) => (
        <div key={id} className="space-y-2">
          <div className="flex items-center gap-2">
            <input name="url" type="url" required placeholder="https://" className={input} aria-label={`링크 주소 ${i + 1}`} />
            {rows.length > 1 && (
              <button type="button" className={btn.small} aria-label={`링크 ${i + 1} 빼기`} onClick={() => setRows((r) => r.filter((x) => x !== id))}>
                ✕
              </button>
            )}
          </div>
          <input name="title" maxLength={200} placeholder="링크 이름 (선택)" className={input} aria-label={`링크 이름 ${i + 1}`} />
        </div>
      ))}
      {rows.length < MAX_LINKS && (
        <button type="button" className={btn.small} onClick={() => setRows((r) => [...r, next.current++])}>
          + 링크 칸 추가
        </button>
      )}
    </div>
  );
}
