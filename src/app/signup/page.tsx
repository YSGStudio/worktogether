import Link from "next/link";
import { teacherSignUp } from "@/actions/auth";
import { ActionForm } from "@/components/ActionForm";
import { btn, Card, Field, input } from "@/components/ui";

export default function TeacherSignUp() {
  return (
    <main className="auth-shell">
      <div className="auth-panel">
      <div className="auth-brand"><span className="auth-brand-mark" aria-hidden="true">📝</span><h1 className="text-3xl font-black">선생님 가입</h1><p className="mt-1 font-semibold text-white/80">즐거운 협업 교실을 시작해요</p></div>
      <Card className="rounded-3xl p-6 shadow-[0_24px_60px_rgba(20,22,70,0.28)] sm:p-7">
        <ActionForm action={teacherSignUp} className="space-y-3">
          <Field label="이름">
            <input name="name" required maxLength={30} className={input} />
          </Field>
          <Field label="이메일">
            <input name="email" type="email" required autoComplete="email" className={input} />
          </Field>
          <Field label="비밀번호" hint="8자 이상">
            <input name="password" type="password" required minLength={8} autoComplete="new-password" className={input} />
          </Field>
          <button className={`${btn.primary} w-full`}>가입하기</button>
        </ActionForm>
      </Card>
      <p className="auth-help mt-5 text-sm">
        이미 가입했나요? <Link href="/login">로그인</Link>
      </p>
      </div>
    </main>
  );
}
