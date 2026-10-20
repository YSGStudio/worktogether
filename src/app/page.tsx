import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/auth";
import { btn } from "@/components/ui";

export default async function Landing() {
  const me = await getSessionProfile().catch(() => null);
  if (me) redirect(me.role === "teacher" ? "/teacher" : "/home");
  return (
    <main className="auth-shell">
      <div className="w-full max-w-3xl">
        <div className="auth-brand">
          <span className="auth-brand-mark" aria-hidden="true">✦</span>
          <h1 className="text-3xl font-black tracking-tight sm:text-4xl">모둠 프로젝트 플래너</h1>
          <p className="mx-auto mt-3 max-w-xl text-lg font-semibold text-white/85">
            친구들과 목표를 나누고, 할 일을 정하고, 멋진 결과물을 한곳에 모아요!
          </p>
        </div>
        <section className="rounded-3xl border border-white/40 bg-white p-5 shadow-[0_24px_70px_rgba(20,22,70,0.3)] sm:p-8">
          <div className="mb-6 grid grid-cols-3 gap-2 text-center text-sm font-extrabold text-[#4e5067]">
            <div className="rounded-2xl bg-[#f0f1ff] p-3"><span className="block text-2xl" aria-hidden="true">🎯</span>목표 정하기</div>
            <div className="rounded-2xl bg-[#effaf3] p-3"><span className="block text-2xl" aria-hidden="true">🤝</span>함께 하기</div>
            <div className="rounded-2xl bg-[#fff5df] p-3"><span className="block text-2xl" aria-hidden="true">🏆</span>완성하기</div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Link href="/student-login" className={`${btn.primary} py-4 text-lg`}>
              <span aria-hidden="true">🚀</span> 학생으로 시작하기
            </Link>
            <Link href="/login" className={`${btn.secondary} py-4 text-lg`}>
              <span aria-hidden="true">🍎</span> 선생님으로 시작하기
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
