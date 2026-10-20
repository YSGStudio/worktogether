import Link from "next/link";
import { studentSignIn } from "@/actions/auth";
import { ActionForm } from "@/components/ActionForm";
import { btn, Card, Field, input } from "@/components/ui";

export default async function StudentLogin({ searchParams }: PageProps<"/student-login">) {
  const { code } = await searchParams;
  return (
    <main className="auth-shell">
      <div className="auth-panel">
      <div className="auth-brand"><span className="auth-brand-mark" aria-hidden="true">🚀</span><h1 className="text-3xl font-black">학생 로그인</h1><p className="mt-1 font-semibold text-white/80">친구들이 기다리는 프로젝트 방으로!</p></div>
      <Card className="rounded-3xl p-6 shadow-[0_24px_60px_rgba(20,22,70,0.28)] sm:p-7">
        <ActionForm action={studentSignIn} className="space-y-3">
          <Field label="학급코드" hint="선생님이 알려 준 숫자 6자리">
            <input
              name="code"
              required
              maxLength={6}
              defaultValue={typeof code === "string" ? code.toUpperCase() : ""}
              autoCapitalize="characters"
              autoComplete="off"
              placeholder="예: 482915"
              className={`${input} uppercase tracking-widest`}
            />
          </Field>
          <Field label="이름">
            <input name="name" required maxLength={30} autoComplete="off" className={input} />
          </Field>
          <Field label="비밀번호" hint="숫자 4자리">
            <input
              name="pin"
              required
              inputMode="numeric"
              pattern="\d{4}"
              maxLength={4}
              type="password"
              autoComplete="off"
              className={`${input} tracking-widest`}
            />
          </Field>
          <button className={`${btn.primary} w-full py-3 text-lg`}>들어가기</button>
        </ActionForm>
      </Card>
      <p className="auth-help mt-5 text-sm">
        비밀번호를 잊었다면 선생님께 말씀하세요. 자기 비밀번호는 친구에게 알려 주지 마세요.
      </p>
      <p className="auth-help mt-2 text-sm">
        <Link href="/login">선생님 로그인</Link>
      </p>
      </div>
    </main>
  );
}
