import Link from "next/link";
import { btn } from "@/components/ui";

export default function NotFound() {
  return (
    <main className="mx-auto grid w-full max-w-lg flex-1 place-content-center px-4 py-16 text-center">
      <span className="mb-4 text-7xl" aria-hidden="true">🧭</span>
      <h1 className="text-2xl font-black text-[#30324a]">앗, 길을 잃었어요!</h1>
      <p className="mt-2 text-stone-600">주소가 맞는지, 내가 볼 수 있는 방인지 확인해 주세요.</p>
      <Link href="/home" className={`${btn.primary} mt-6`}>
        처음으로
      </Link>
    </main>
  );
}
