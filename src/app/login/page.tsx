import Link from "next/link";
import { teacherSignIn } from "@/actions/auth";
import { ActionForm } from "@/components/ActionForm";
import { btn, Card, Field, input } from "@/components/ui";

export default function TeacherLogin() {
  return (
    <main className="auth-shell">
      <div className="auth-panel">
      <div className="auth-brand"><span className="auth-brand-mark" aria-hidden="true">🍎</span><h1 className="text-3xl font-black">선생님 로그인</h1><p className="mt-1 font-semibold text-white/80">우리 반 프로젝트를 만나 보세요</p></div>
      <Card className="rounded-3xl p-6 shadow-[0_24px_60px_rgba(20,22,70,0.28)] sm:p-7">
        <ActionForm action={teacherSignIn} className="space-y-3">
          <Field label="이메일">
            <input name="email" type="email" required autoComplete="email" className={input} />
          </Field>
          <Field label="비밀번호">
            <input name="password" type="password" required autoComplete="current-password" className={input} />
          </Field>
          <button className={`${btn.primary} w-full`}>로그인</button>
        </ActionForm>
      </Card>
      <p className="auth-help mt-5 text-sm">
        처음이신가요? <Link href="/signup">선생님 가입</Link>
        {" · "}
        <Link href="/student-login">학생 로그인</Link>
      </p>
      </div>
    </main>
  );
}
