// RLS·E2E 테스트가 중간에 멈췄을 때 남은 테스트 데이터만 지운다.
// 지우는 대상: @test.local 교사 계정, 그 교사의 학급, 그 학급에 속한 학생 계정.
// 실제 교사(@test.local이 아닌 계정)와 그 학급의 학생은 건드리지 않는다.
import { createClient } from "@supabase/supabase-js";

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
const testTeachers = data.users.filter((u) => (u.email ?? "").endsWith("@test.local")).map((u) => u.id);

let classIds = [];
let studentIds = [];
if (testTeachers.length) {
  const { data: classes } = await admin.from("classes").select("id").in("teacher_id", testTeachers);
  classIds = (classes ?? []).map((c) => c.id);
  if (classIds.length) {
    const { data: students } = await admin.from("profiles").select("id").in("class_id", classIds).eq("role", "student");
    studentIds = (students ?? []).map((s) => s.id);
    await admin.from("topics").delete().in("class_id", classIds);
    await admin.from("classes").delete().in("id", classIds);
  }
}
for (const id of [...studentIds, ...testTeachers]) await admin.auth.admin.deleteUser(id);
console.log(`지운 테스트 교사 ${testTeachers.length}명, 학급 ${classIds.length}개, 학생 ${studentIds.length}명 (전체 계정 ${data.users.length}개 중)`);
