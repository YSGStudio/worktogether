import Link from "next/link";
import { signOut } from "@/actions/auth";
import type { Profile } from "@/lib/types";

export function TopBar({ me }: { me: Profile }) {
  return (
    <header className="no-print border-b border-black/20 bg-[#2b2d31] text-white shadow-lg">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
        <Link href={me.role === "teacher" ? "/teacher" : "/home"} className="flex min-w-0 items-center gap-2.5 font-black hover:text-[#c9cdfb]">
          <span aria-hidden="true" className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#5865f2] text-lg shadow-inner">✦</span>
          <span className="truncate">모둠 프로젝트 플래너</span>
        </Link>
        <div className="flex shrink-0 items-center gap-2 text-sm">
          <span className="hidden rounded-full bg-[#404249] px-3 py-1.5 font-semibold text-[#dbdee1] sm:inline">
            {me.name} {me.role === "teacher" ? "선생님" : ""}
          </span>
          <form action={signOut}>
            <button className="rounded-lg px-2.5 py-1.5 font-bold text-[#b5bac1] hover:bg-[#404249] hover:text-white">로그아웃</button>
          </form>
        </div>
      </div>
    </header>
  );
}

export function Main({ children }: { children: React.ReactNode }) {
  return <main className="discord-shell mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">{children}</main>;
}
