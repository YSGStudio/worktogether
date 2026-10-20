import { requireTeacher } from "@/lib/auth";
import { notFound } from "next/navigation";
import { createTopic } from "@/actions/topics";
import { TopicForm } from "@/components/teacher/TopicForm";
import { BackLink, Card, PageTitle } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

export default async function NewTopic({ params }: PageProps<"/teacher/classes/[classId]/topics/new">) {
  await requireTeacher();
  const { classId } = await params;
  const supabase = await createClient();
  const { data: cls } = await supabase.from("classes").select("id, name").eq("id", classId).maybeSingle();
  if (!cls) notFound();
  const { data: students } = await supabase.from("profiles").select("id, role, name, class_id").eq("class_id", classId).order("name");
  return (
    <>
      <BackLink href={`/teacher/classes/${classId}`}>{cls.name}</BackLink>
      <PageTitle>주제 등록</PageTitle>
      <Card className="max-w-3xl">
        <TopicForm action={createTopic.bind(null, classId)} students={(students ?? []) as Profile[]} submitLabel="주제 등록" />
      </Card>
    </>
  );
}
