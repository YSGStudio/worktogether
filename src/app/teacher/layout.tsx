import { requireTeacher } from "@/lib/auth";
import { Main, TopBar } from "@/components/TopBar";

export default async function TeacherLayout({ children }: LayoutProps<"/teacher">) {
  const me = await requireTeacher();
  return (
    <>
      <TopBar me={me} />
      <Main>{children}</Main>
    </>
  );
}
