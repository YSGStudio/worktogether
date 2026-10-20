import Link from "next/link";
import type { ReactNode } from "react";
import type { TaskStatus } from "@/lib/domain/dates";
import { STATUS_LABEL } from "@/lib/domain/status";

export const btn = {
  primary:
    "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-[#5865f2] px-4 py-2.5 font-extrabold text-white shadow-[0_4px_0_#3f49b5] hover:-translate-y-0.5 hover:bg-[#4752c4] hover:shadow-[0_6px_0_#343d9d] disabled:opacity-50",
  secondary:
    "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border-2 border-[#d9dcef] bg-white px-4 py-2 font-bold text-[#3b3d55] shadow-sm hover:-translate-y-0.5 hover:border-[#aeb4f8] hover:bg-[#f5f6ff] disabled:opacity-50",
  danger:
    "inline-flex items-center justify-center gap-1 rounded-xl border-2 border-red-200 bg-white px-3 py-1.5 text-sm font-bold text-red-700 hover:border-red-300 hover:bg-red-50 disabled:opacity-50",
  small:
    "inline-flex items-center justify-center gap-1 rounded-lg border-2 border-[#d9dcef] bg-white px-2.5 py-1 text-sm font-bold hover:border-[#aeb4f8] hover:bg-[#f5f6ff] disabled:opacity-50",
};

export const input =
  "w-full min-w-0 rounded-xl border-2 border-[#dfe1eb] bg-[#f7f8fb] px-3.5 py-2.5 text-base text-[#24253a] placeholder:text-stone-400 hover:border-[#c9ccec] focus:border-[#5865f2] focus:bg-white focus:outline-none focus:ring-4 focus:ring-[#5865f2]/15";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-[#e2e4ef] bg-white p-4 shadow-[0_5px_18px_rgba(45,47,68,0.07)] sm:p-5 ${className}`}>{children}</section>;
}

export function PageTitle({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <div className="mb-5 border-b border-[#e3e5ee] pb-3">
      <h1 className="text-2xl font-black tracking-tight text-[#24253a] break-words sm:text-3xl">{children}</h1>
      {sub && <p className="mt-1 text-[#66697f] break-words">{sub}</p>}
    </div>
  );
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <h2 className="text-lg font-extrabold text-[#30324a]">{children}</h2>
      {right}
    </div>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block min-w-0">
      <span className="mb-1.5 block text-sm font-extrabold text-[#4c4f68]">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-stone-500">{hint}</span>}
    </label>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-2xl border-2 border-dashed border-[#cfd2e4] bg-[#f8f8fc] p-6 text-center font-medium text-[#74778b]">💬 {children}</p>;
}

export function Badge({ children, tone = "stone" }: { children: ReactNode; tone?: "stone" | "blue" | "green" | "red" | "amber" | "violet" }) {
  const tones = {
    stone: "bg-[#ebecef] text-[#4e5058]",
    blue: "bg-[#e2e5ff] text-[#3f49b5]",
    green: "bg-[#d9fbe5] text-[#18733a]",
    red: "bg-[#ffe1e4] text-[#a12835]",
    amber: "bg-[#fff0c2] text-[#805900]",
    violet: "bg-[#eee5ff] text-[#7147b8]",
  };
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-extrabold whitespace-nowrap ${tones[tone]}`}>{children}</span>;
}

export function StatusBadge({ status }: { status: TaskStatus }) {
  const tone = status === "done" ? "green" : status === "doing" ? "blue" : "stone";
  return <Badge tone={tone}>{STATUS_LABEL[status]}</Badge>;
}

export function OverdueBadge() {
  return <Badge tone="red">기한 지남</Badge>;
}

export function Progress({ done, total }: { done: number; total: number }) {
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  return (
    <div className="min-w-0">
      <div className="mb-1 flex justify-between text-sm">
        <span className="font-semibold">진행률</span>
        <span>
          {done}/{total} ({pct}%)
        </span>
      </div>
      <div className="h-4 w-full overflow-hidden rounded-full bg-[#e5e7f0] p-0.5" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full rounded-full bg-gradient-to-r from-[#5865f2] to-[#57b87c]" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="mb-3 inline-flex items-center rounded-lg px-2 py-1 text-sm font-bold text-[#5865f2] hover:bg-[#e8eaff]">
      ← {children}
    </Link>
  );
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDate(d: string | null): string {
  if (!d) return "날짜 미정";
  const [, m, day] = d.split("-");
  return `${Number(m)}/${Number(day)}`;
}

export function formatRange(start: string | null, end: string | null): string {
  if (!start && !end) return "날짜 미정";
  if (start === end || !start) return formatDate(end);
  if (!end) return `${formatDate(start)}~`;
  return `${formatDate(start)} ~ ${formatDate(end)}`;
}
