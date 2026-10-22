"use client";

import { useRef, useState, useTransition } from "react";
import { MAX_FILES } from "@/lib/domain/upload";
import type { ActionResult } from "@/lib/types";
import { btn, Field } from "./ui";

const ACCEPT = ".pdf,.png,.jpg,.jpeg,.webp,.gif,application/pdf,image/png,image/jpeg,image/webp,image/gif";

// 파일 여러 개를 한 개씩 차례로 올린다. 요청 한 번의 본문 한도(11MB)를 넘지 않게 하려는 것.
export function FileUploadForm({ action, className }: { action: (prev: unknown, fd: FormData) => Promise<ActionResult>; className?: string }) {
  const ref = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  const [progress, setProgress] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const files = Array.from(ref.current?.files ?? []);
    setMessage(null);
    if (files.length === 0) return setErrors(["올릴 파일을 고르세요"]);
    if (files.length > MAX_FILES) return setErrors([`파일은 한 번에 ${MAX_FILES}개까지 올릴 수 있어요`]);
    setErrors([]);
    start(async () => {
      const failed: string[] = [];
      let done = 0;
      for (const [i, file] of files.entries()) {
        setProgress(`${i + 1}/${files.length} 올리는 중…`);
        const fd = new FormData();
        fd.append("file", file);
        try {
          const r = await action(null, fd);
          if (r.ok) done++;
          else failed.push(`${file.name}: ${r.error}`);
        } catch {
          failed.push(`${file.name}: 올리지 못했어요`);
        }
      }
      setProgress(null);
      setErrors(failed);
      if (done > 0) setMessage(files.length > 1 ? `파일 ${done}개를 올렸어요` : "파일을 올렸어요");
      if (failed.length === 0 && ref.current) ref.current.value = "";
    });
  }

  return (
    <form onSubmit={submit} aria-busy={pending} className="min-w-0">
      <fieldset disabled={pending} className={`m-0 min-w-0 border-0 p-0 ${className ?? ""}`}>
        <Field label="파일 첨부" hint={`PDF, 이미지(PNG·JPG·WEBP·GIF), 한 개에 10MB 이하, 한 번에 ${MAX_FILES}개까지. 개인정보가 담긴 사진은 올리지 마세요.`}>
          <input ref={ref} type="file" name="file" multiple required accept={ACCEPT} className="block w-full text-sm" />
        </Field>
        <button className={btn.secondary}>{progress ?? "파일 올리기"}</button>
      </fieldset>
      {errors.length > 0 && (
        <ul role="alert" className="mt-2 space-y-0.5 text-sm font-medium text-red-700">
          {errors.map((e) => (
            <li key={e} className="break-words">{e}</li>
          ))}
        </ul>
      )}
      {message && <p className="mt-2 text-sm font-medium text-green-700">{message}</p>}
    </form>
  );
}
