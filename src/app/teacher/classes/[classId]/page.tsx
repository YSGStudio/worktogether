import { requireTeacher } from "@/lib/auth";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  deleteClass,
  deleteStudent,
  regenerateClassCode,
  registerOneStudent,
  registerStudents,
  renameClass,
  renameStudent,
  resetAllPins,
  resetStudentPin,
  unlockStudent,
} from "@/actions/classes";
import { ActionForm } from "@/components/ActionForm";
import { ConfirmButton } from "@/components/ConfirmButton";
import { BulkRegisterForm, OneRegisterForm, ResetPinForm } from "@/components/teacher/StudentForms";
import { Badge, BackLink, btn, Card, Empty, formatRange, input, PageTitle, SectionTitle } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { lockedStudentIds } from "@/lib/loginLock";
import type { ClassRow, Profile, Topic } from "@/lib/types";

export default async function ClassPage({ params }: PageProps<"/teacher/classes/[classId]">) {
  await requireTeacher();
  const { classId } = await params;
  const supabase = await createClient();
  const { data: cls } = await supabase.from("classes").select("*").eq("id", classId).maybeSingle();
  if (!cls) notFound();
  const c = cls as ClassRow;
  const [{ data: studentRows }, { data: topicRows }] = await Promise.all([
    supabase.from("profiles").select("id, role, name, class_id").eq("class_id", classId).order("name"),
    supabase.from("topics").select("*").eq("class_id", classId).order("start_date", { ascending: false }),
  ]);
  const students = (studentRows ?? []) as Profile[];
  const topics = (topicRows ?? []) as Topic[];
  const locked = await lockedStudentIds(students.map((s) => s.id));

  return (
    <>
      <BackLink href="/teacher">내 학급</BackLink>
      <PageTitle>{c.name}</PageTitle>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <SectionTitle>학급코드</SectionTitle>
          <p className="font-mono text-4xl font-bold tracking-[0.3em]">{c.code}</p>
          <p className="mt-2 text-sm text-stone-600 break-all">
            학생 로그인 주소: <span className="font-mono">/student-login?code={c.code}</span>
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <ConfirmButton
              action={regenerateClassCode.bind(null, c.id)}
              confirm="학급코드를 다시 만들까요? 이전 코드로는 더 이상 로그인할 수 없어요."
              className={btn.secondary}
            >
              학급코드 다시 만들기
            </ConfirmButton>
          </div>
          <ActionForm action={renameClass.bind(null, c.id)} className="mt-4 flex flex-wrap items-start gap-2">
            <input name="name" defaultValue={c.name} required maxLength={50} className={`${input} max-w-xs`} aria-label="학급 이름" />
            <button className={btn.secondary}>이름 바꾸기</button>
          </ActionForm>
          <div className="mt-4">
            <ConfirmButton action={deleteClass.bind(null, c.id)} confirm={`${c.name} 학급을 지울까요? 학생 계정과 모든 주제·방·자료가 함께 지워져요.`}>
              학급 삭제
            </ConfirmButton>
          </div>
        </Card>

        <Card>
          <SectionTitle right={<Link href={`/teacher/classes/${c.id}/topics/new`} className={btn.primary}>주제 등록</Link>}>
            주제
          </SectionTitle>
          {topics.length === 0 ? (
            <Empty>아직 주제가 없어요</Empty>
          ) : (
            <ul className="divide-y">
              {topics.map((t) => (
                <li key={t.id} className="py-2">
                  <Link href={`/teacher/topics/${t.id}`} className="font-semibold text-blue-700 hover:underline break-words">
                    {t.title}
                  </Link>
                  <span className="ml-2 text-sm text-stone-600">{formatRange(t.start_date, t.end_date)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card className="mt-4">
        <SectionTitle>학생 등록</SectionTitle>
        <div className="grid gap-6 lg:grid-cols-2">
          <BulkRegisterForm action={registerStudents.bind(null, c.id)} classCode={c.code} />
          <OneRegisterForm action={registerOneStudent.bind(null, c.id)} classCode={c.code} />
        </div>
      </Card>

      <Card className="mt-4">
        <SectionTitle
          right={
            students.length > 0 && (
              <ConfirmButton
                action={resetAllPins.bind(null, c.id)}
                confirm={`학생 ${students.length}명의 비밀번호를 모두 1234로 바꿀까요?`}
                className={btn.secondary}
              >
                전체 비밀번호 1234로 초기화
              </ConfirmButton>
            )
          }
        >
          학생 {students.length}명
        </SectionTitle>
        {students.length === 0 ? (
          <Empty>아직 학생이 없어요</Empty>
        ) : (
          <ul className="divide-y">
            {students.map((s) => (
              <li key={s.id} className="flex flex-col gap-2 py-3 md:flex-row md:items-start md:justify-between">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{s.name}</span>
                  {locked.has(s.id) && <Badge tone="red">로그인 잠김</Badge>}
                </div>
                <div className="flex flex-wrap items-start gap-2">
                  <ActionForm action={renameStudent.bind(null, s.id)} className="flex items-start gap-1">
                    <input name="name" defaultValue={s.name} required maxLength={30} className={`${input} w-28 py-1 text-sm`} aria-label={`${s.name} 이름`} />
                    <button className={btn.small}>이름 수정</button>
                  </ActionForm>
                  <ResetPinForm action={resetStudentPin.bind(null, s.id)} classCode={c.code} />
                  {locked.has(s.id) && (
                    <ConfirmButton action={unlockStudent.bind(null, s.id)} className={btn.small}>
                      잠금 풀기
                    </ConfirmButton>
                  )}
                  <ConfirmButton action={deleteStudent.bind(null, s.id)} confirm={`${s.name} 학생을 지울까요? 이 학생의 계정이 사라져요.`}>
                    삭제
                  </ConfirmButton>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
