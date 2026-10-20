"use client";

import type { PinRow } from "@/actions/classes";
import type { ActionResult } from "@/lib/types";
import { ActionForm } from "@/components/ActionForm";
import { PinTable } from "@/components/PinTable";
import { btn, Field, input } from "@/components/ui";

type PinAction = (prev: unknown, fd: FormData) => Promise<ActionResult<PinRow[]>>;

export function BulkRegisterForm({ action, classCode }: { action: PinAction; classCode: string }) {
  return (
    <ActionForm action={action} resetOnSuccess className="space-y-3" renderData={(rows) => <PinTable rows={rows} classCode={classCode} />}>
      <Field label="이름 목록 붙여넣기" hint="한 줄에 한 명. 처음 비밀번호는 모두 1234예요. 동명이인은 김민준A처럼 구분하세요.">
        <textarea name="names" rows={6} required className={input} placeholder={"김민준\n이서연\n박지호"} />
      </Field>
      <button className={btn.primary}>여러 명 등록</button>
    </ActionForm>
  );
}

export function OneRegisterForm({ action, classCode }: { action: PinAction; classCode: string }) {
  return (
    <ActionForm action={action} resetOnSuccess className="space-y-3" renderData={(rows) => <PinTable rows={rows} classCode={classCode} />}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="이름">
          <input name="name" required maxLength={30} className={input} />
        </Field>
        <Field label="비밀번호" hint="비워 두면 1234">
          <input name="pin" inputMode="numeric" maxLength={4} placeholder="숫자 4자리" className={input} />
        </Field>
      </div>
      <button className={btn.secondary}>한 명 등록</button>
    </ActionForm>
  );
}

export function ResetPinForm({ action, classCode }: { action: PinAction; classCode: string }) {
  return (
    <ActionForm action={action} className="flex flex-wrap items-start gap-2" renderData={(rows) => <PinTable rows={rows} classCode={classCode} />}>
      <input name="pin" inputMode="numeric" maxLength={4} placeholder="새 PIN(비우면 1234)" className={`${input} w-40 py-1 text-sm`} aria-label="새 비밀번호" />
      <button className={btn.small}>비밀번호 재설정</button>
    </ActionForm>
  );
}
