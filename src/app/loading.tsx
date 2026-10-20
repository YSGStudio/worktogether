import { LoadingPanel } from "@/components/ui";

// 상단 바가 없는 화면(방 입장, 학생 홈·주제 등)으로 옮길 때
export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
      <LoadingPanel />
    </main>
  );
}
