"use client";

import { useActionState, useEffect, useRef, type ReactNode } from "react";
import type { ActionResult } from "@/lib/types";

type Props<T> = {
  action: (prev: unknown, fd: FormData) => Promise<ActionResult<T>>;
  children: ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
  renderData?: (data: T) => ReactNode;
};

// 서버 액션 결과(오류·성공 문구)를 폼 아래에 보여준다.
export function ActionForm<T>({ action, children, className, resetOnSuccess, renderData }: Props<T>) {
  const [state, formAction, pending] = useActionState(action, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok && resetOnSuccess) ref.current?.reset();
  }, [state, resetOnSuccess]);
  return (
    <form ref={ref} action={formAction} aria-busy={pending} className="min-w-0">
      <fieldset disabled={pending} className={`m-0 min-w-0 border-0 p-0 ${className ?? ""}`}>
        {children}
      </fieldset>
      {state && !state.ok && (
        <p role="alert" className="mt-2 text-sm font-medium text-red-700">
          {state.error}
        </p>
      )}
      {state?.ok && state.message && <p className="mt-2 text-sm font-medium text-green-700">{state.message}</p>}
      {state?.ok && state.data !== undefined && renderData?.(state.data)}
    </form>
  );
}
