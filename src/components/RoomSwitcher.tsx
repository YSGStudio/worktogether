"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

// 상단 "다른 방 보기": 고르면 그 방 대시보드로 이동한다
export function RoomSwitcher({ rooms, currentId }: { rooms: { id: string; label: string }[]; currentId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <label className="flex w-full min-w-0 items-center gap-2 sm:w-auto">
      <span className="shrink-0 text-sm font-bold text-[#4c4f68]">다른 방 보기</span>
      <select
        value={currentId}
        disabled={pending}
        onChange={(e) => start(() => router.push(`/p/${e.target.value}`))}
        className="min-h-10 w-full min-w-0 cursor-pointer rounded-xl border-2 border-[#d9dcef] bg-white px-3 py-1.5 text-sm font-bold text-[#24253a] hover:border-[#aeb4f8] focus:border-[#5865f2] focus:outline-none focus:ring-4 focus:ring-[#5865f2]/15 disabled:opacity-60 sm:w-64"
      >
        {rooms.map((r) => (
          <option key={r.id} value={r.id}>
            {r.label}
          </option>
        ))}
      </select>
    </label>
  );
}
