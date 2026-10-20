import { requireTeacher } from "@/lib/auth";
import Link from "next/link";
import { createClass } from "@/actions/classes";
import { ActionForm } from "@/components/ActionForm";
import { btn, Card, Empty, Field, input, PageTitle, SectionTitle } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import type { ClassRow } from "@/lib/types";

export default async function TeacherHome() {
  await requireTeacher();
  const supabase = await createClient();
  const { data } = await supabase.from("classes").select("*").order("created_at");
  const classes = (data ?? []) as ClassRow[];
  return (
    <>
      <PageTitle sub="학급을 고르면 학생과 주제를 관리할 수 있어요">내 학급</PageTitle>
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="grid content-start gap-3 sm:grid-cols-2">
          {classes.length === 0 && <Empty>아직 학급이 없어요. 오른쪽에서 학급을 만들어 보세요.</Empty>}
          {classes.map((c) => (
            <Link key={c.id} href={`/teacher/classes/${c.id}`} className="block">
              <Card className="h-full hover:border-blue-400">
                <h2 className="text-lg font-bold break-words">{c.name}</h2>
                <p className="mt-1 text-sm text-stone-600">
                  학급코드 <span className="font-mono text-base font-bold tracking-widest text-stone-900">{c.code}</span>
                </p>
              </Card>
            </Link>
          ))}
        </div>
        <Card>
          <SectionTitle>학급 만들기</SectionTitle>
          <ActionForm action={createClass} resetOnSuccess className="space-y-3">
            <Field label="학급 이름">
              <input name="name" required maxLength={50} placeholder="예: 5학년 2반" className={input} />
            </Field>
            <button className={`${btn.primary} w-full`}>만들기</button>
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
