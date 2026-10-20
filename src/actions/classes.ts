"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, pinPepper } from "@/lib/supabase/admin";
import { requireTeacher } from "@/lib/auth";
import { generateClassCode } from "@/lib/domain/classCode";
import { DEFAULT_PIN, isValidPin, pinToPassword, studentAuthEmail } from "@/lib/domain/pin";
import { MAX_NAME_LENGTH, parseNameList } from "@/lib/domain/names";
import { friendlyError } from "@/lib/errors";
import { str } from "@/lib/form";
import type { ActionResult } from "@/lib/types";
import { classFilePaths, removePaths } from "@/lib/storage";

export type PinRow = { name: string; pin: string };

async function insertWithUniqueCode(fn: (code: string) => PromiseLike<{ error: { code?: string; message?: string } | null }>) {
  for (let i = 0; i < 8; i++) {
    const { error } = await fn(generateClassCode());
    if (!error) return null;
    if (error.code !== "23505") return error;
  }
  return { code: "23505", message: "학급코드를 만들지 못했어요" };
}

export async function createClass(_prev: unknown, fd: FormData): Promise<ActionResult> {
  const me = await requireTeacher();
  const name = str(fd, "name");
  if (!name) return { ok: false, error: "학급 이름을 입력하세요" };
  const supabase = await createClient();
  const error = await insertWithUniqueCode((code) =>
    supabase.from("classes").insert({ name, code, teacher_id: me.id }),
  );
  if (error) return { ok: false, error: friendlyError(error) };
  revalidatePath("/teacher");
  return { ok: true, message: "학급을 만들었어요" };
}

export async function renameClass(classId: string, _prev: unknown, fd: FormData): Promise<ActionResult> {
  await requireTeacher();
  const name = str(fd, "name");
  if (!name) return { ok: false, error: "학급 이름을 입력하세요" };
  const supabase = await createClient();
  const { data, error } = await supabase.from("classes").update({ name }).eq("id", classId).select("id");
  if (error || !data?.length) return { ok: false, error: friendlyError(error, "권한이 없어요") };
  revalidatePath(`/teacher/classes/${classId}`);
  return { ok: true, message: "저장했어요" };
}

export async function regenerateClassCode(classId: string): Promise<ActionResult> {
  await requireTeacher();
  const supabase = await createClient();
  let updated = false;
  const error = await insertWithUniqueCode(async (code) => {
    const res = await supabase.from("classes").update({ code }).eq("id", classId).select("id");
    updated = !!res.data?.length;
    return res;
  });
  if (error || !updated) return { ok: false, error: friendlyError(error, "권한이 없어요") };
  revalidatePath(`/teacher/classes/${classId}`);
  return { ok: true, message: "새 학급코드를 만들었어요. 이전 코드로는 로그인할 수 없어요." };
}

export async function deleteClass(classId: string): Promise<ActionResult> {
  await requireTeacher();
  const supabase = await createClient();
  const { data: cls } = await supabase.from("classes").select("id").eq("id", classId).maybeSingle();
  if (!cls) return { ok: false, error: "권한이 없어요" };
  const { data: students } = await supabase.from("profiles").select("id").eq("class_id", classId);
  const admin = createAdminClient();
  const paths = await classFilePaths(admin, classId);
  // 주제(방·할 일)를 먼저 지운다. 한 번에 학급을 지우면 cascade 중 같은 할 일 행이 두 번 갱신되어 FK 검사에 걸린다.
  const { error: topicError } = await supabase.from("topics").delete().eq("class_id", classId);
  if (topicError) return { ok: false, error: friendlyError(topicError) };
  const { error } = await supabase.from("classes").delete().eq("id", classId);
  if (error) return { ok: false, error: friendlyError(error) };
  await removePaths(admin, paths);
  // 학생 로그인 계정도 지운다
  for (const s of students ?? []) await admin.auth.admin.deleteUser(s.id);
  revalidatePath("/teacher");
  redirect("/teacher");
}

async function assertOwnClass(classId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("classes").select("id").eq("id", classId).maybeSingle();
  return !!data;
}

async function createStudent(classId: string, name: string, pin: string) {
  const admin = createAdminClient();
  const id = randomUUID();
  const { error } = await admin.auth.admin.createUser({
    id,
    email: studentAuthEmail(id),
    password: pinToPassword(id, pin, pinPepper()),
    email_confirm: true,
    app_metadata: { role: "student", class_id: classId, name },
  });
  if (error) return error;
  // 프로필은 서버가 직접 만든다(가입 트리거 시점에는 app_metadata가 아직 없다)
  const { error: profileError } = await admin
    .from("profiles")
    .upsert({ id, role: "student", name, class_id: classId }, { onConflict: "id" });
  if (profileError) {
    await admin.auth.admin.deleteUser(id);
    return profileError;
  }
  return null;
}

// 이름 목록 붙여넣기: 처음 비밀번호는 모두 1234
export async function registerStudents(
  classId: string,
  _prev: unknown,
  fd: FormData,
): Promise<ActionResult<PinRow[]>> {
  await requireTeacher();
  if (!(await assertOwnClass(classId))) return { ok: false, error: "권한이 없어요" };
  const { names, duplicates, invalid } = parseNameList(str(fd, "names"));
  if (invalid.length) return { ok: false, error: `이름은 ${MAX_NAME_LENGTH}자 이하로 써 주세요: ${invalid.join(", ")}` };
  if (duplicates.length) return { ok: false, error: `목록에 같은 이름이 있어요: ${duplicates.join(", ")} (김민준A처럼 구분해 주세요)` };
  if (names.length === 0) return { ok: false, error: "이름을 한 줄에 한 명씩 입력하세요" };
  if (names.length > 60) return { ok: false, error: "한 번에 60명까지 등록할 수 있어요" };
  return registerMany(classId, names.map((name) => ({ name, pin: DEFAULT_PIN })));
}

// 한 명 등록: 비밀번호를 직접 입력하거나 비워 두면 1234
export async function registerOneStudent(
  classId: string,
  _prev: unknown,
  fd: FormData,
): Promise<ActionResult<PinRow[]>> {
  await requireTeacher();
  if (!(await assertOwnClass(classId))) return { ok: false, error: "권한이 없어요" };
  const name = str(fd, "name").replace(/\s+/g, " ");
  const pinInput = str(fd, "pin");
  if (!name || name.length > MAX_NAME_LENGTH) return { ok: false, error: `이름을 ${MAX_NAME_LENGTH}자 이하로 입력하세요` };
  if (pinInput && !isValidPin(pinInput)) return { ok: false, error: "비밀번호는 숫자 4자리여야 해요" };
  return registerMany(classId, [{ name, pin: pinInput || DEFAULT_PIN }]);
}

async function registerMany(classId: string, rows: PinRow[]): Promise<ActionResult<PinRow[]>> {
  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("profiles")
    .select("name")
    .eq("class_id", classId)
    .in("name", rows.map((r) => r.name));
  if (existing?.length) {
    return {
      ok: false,
      error: `이 학급에 이미 있는 이름이에요: ${existing.map((e) => e.name).join(", ")} (김민준A처럼 구분해 주세요)`,
    };
  }
  // 계정 만들기는 한 번에 5명씩 동시에 처리한다(학생이 많을 때 기다리는 시간을 줄인다)
  const results: (PinRow | null)[] = new Array(rows.length).fill(null);
  for (let i = 0; i < rows.length; i += 5) {
    await Promise.all(
      rows.slice(i, i + 5).map(async (row, j) => {
        const error = await createStudent(classId, row.name, row.pin);
        if (!error) results[i + j] = row;
      }),
    );
  }
  const created = results.filter((r): r is PinRow => r !== null);
  const failed = rows.filter((_, i) => results[i] === null).map((r) => r.name);
  revalidatePath(`/teacher/classes/${classId}`);
  if (failed.length) {
    return { ok: false, error: `등록하지 못한 학생: ${failed.join(", ")}. 등록된 학생: ${created.map((c) => `${c.name}(${c.pin})`).join(", ") || "없음"}` };
  }
  return { ok: true, data: created, message: `${created.length}명을 등록했어요` };
}

async function ownStudent(studentId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, name, class_id, role")
    .eq("id", studentId)
    .eq("role", "student")
    .maybeSingle();
  if (!data?.class_id) return null;
  return (await assertOwnClass(data.class_id)) ? data : null;
}

export async function resetStudentPin(studentId: string, _prev: unknown, fd: FormData): Promise<ActionResult<PinRow[]>> {
  await requireTeacher();
  const student = await ownStudent(studentId);
  if (!student) return { ok: false, error: "권한이 없어요" };
  const pinInput = str(fd, "pin");
  if (pinInput && !isValidPin(pinInput)) return { ok: false, error: "비밀번호는 숫자 4자리여야 해요" };
  const pin = pinInput || DEFAULT_PIN;
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(studentId, { password: pinToPassword(studentId, pin, pinPepper()) });
  if (error) return { ok: false, error: "비밀번호를 바꾸지 못했어요" };
  return { ok: true, data: [{ name: student.name, pin }], message: `${student.name} 학생의 새 비밀번호: ${pin}` };
}

// 학급 학생 전체 비밀번호를 처음 비밀번호(1234)로 되돌린다
export async function resetAllPins(classId: string): Promise<ActionResult> {
  await requireTeacher();
  if (!(await assertOwnClass(classId))) return { ok: false, error: "권한이 없어요" };
  const admin = createAdminClient();
  const { data: students } = await admin.from("profiles").select("id").eq("class_id", classId).eq("role", "student");
  const ids = (students ?? []).map((s) => s.id as string);
  let failed = 0;
  for (let i = 0; i < ids.length; i += 5) {
    const results = await Promise.all(
      ids.slice(i, i + 5).map((id) => admin.auth.admin.updateUserById(id, { password: pinToPassword(id, DEFAULT_PIN, pinPepper()) })),
    );
    failed += results.filter((r) => r.error).length;
  }
  if (failed) return { ok: false, error: `${failed}명의 비밀번호를 바꾸지 못했어요. 다시 시도해 주세요.` };
  return { ok: true, message: `학생 ${ids.length}명의 비밀번호를 ${DEFAULT_PIN}으로 바꿨어요` };
}

export async function renameStudent(studentId: string, _prev: unknown, fd: FormData): Promise<ActionResult> {
  await requireTeacher();
  const student = await ownStudent(studentId);
  if (!student) return { ok: false, error: "권한이 없어요" };
  const name = str(fd, "name").replace(/\s+/g, " ");
  if (!name || name.length > MAX_NAME_LENGTH) return { ok: false, error: `이름을 ${MAX_NAME_LENGTH}자 이하로 입력하세요` };
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ name }).eq("id", studentId);
  if (error) {
    return { ok: false, error: error.code === "23505" ? "이 학급에 이미 있는 이름이에요" : friendlyError(error) };
  }
  revalidatePath(`/teacher/classes/${student.class_id}`);
  return { ok: true, message: "이름을 바꿨어요" };
}

export async function deleteStudent(studentId: string): Promise<ActionResult> {
  await requireTeacher();
  const student = await ownStudent(studentId);
  if (!student) return { ok: false, error: "권한이 없어요" };
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(studentId);
  if (error) return { ok: false, error: "학생을 지우지 못했어요" };
  revalidatePath(`/teacher/classes/${student.class_id}`);
  return { ok: true, message: "학생을 지웠어요" };
}

export async function unlockStudent(studentId: string): Promise<ActionResult> {
  await requireTeacher();
  const student = await ownStudent(studentId);
  if (!student) return { ok: false, error: "권한이 없어요" };
  const admin = createAdminClient();
  const { error } = await admin
    .from("student_login_attempts")
    .insert({ student_id: studentId, class_code: "-", ip_hash: "teacher-unlock", kind: "unlock" });
  if (error) return { ok: false, error: "잠금을 풀지 못했어요" };
  revalidatePath(`/teacher/classes/${student.class_id}`);
  return { ok: true, message: `${student.name} 학생의 잠금을 풀었어요` };
}
