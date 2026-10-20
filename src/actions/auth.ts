"use server";

import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, pinPepper } from "@/lib/supabase/admin";
import { isValidClassCode, normalizeClassCode } from "@/lib/domain/classCode";
import { isValidPin, pinToPassword, studentAuthEmail } from "@/lib/domain/pin";
import { isIpLimited, LOCK_MINUTES, type Attempt } from "@/lib/domain/lockout";
import { studentLockState } from "@/lib/loginLock";
import { str } from "@/lib/form";
import type { ActionResult } from "@/lib/types";

export async function teacherSignUp(_prev: unknown, fd: FormData): Promise<ActionResult> {
  const name = str(fd, "name");
  const email = str(fd, "email");
  const password = str(fd, "password");
  if (!name || !email) return { ok: false, error: "이름과 이메일을 입력하세요" };
  if (password.length < 8) return { ok: false, error: "비밀번호는 8자 이상이어야 해요" };
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { name } } });
  if (error) return { ok: false, error: "가입하지 못했어요. 이미 가입한 이메일인지 확인하세요." };
  if (!data.session) return { ok: true, message: "가입 확인 메일을 보냈어요. 메일의 링크를 누른 뒤 로그인하세요." };
  redirect("/teacher");
}

export async function teacherSignIn(_prev: unknown, fd: FormData): Promise<ActionResult> {
  const email = str(fd, "email");
  const password = str(fd, "password");
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) return { ok: false, error: "이메일 또는 비밀번호를 확인하세요" };
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", data.user.id).maybeSingle();
  if (profile?.role !== "teacher") {
    await supabase.auth.signOut();
    return { ok: false, error: "이메일 또는 비밀번호를 확인하세요" };
  }
  redirect("/teacher");
}

const STUDENT_FAIL = "학급코드, 이름, 비밀번호를 확인하세요";

async function clientIpHash(): Promise<string> {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
  return createHash("sha256").update(`${pinPepper()}:${ip}`).digest("hex");
}

export async function studentSignIn(_prev: unknown, fd: FormData): Promise<ActionResult> {
  const code = normalizeClassCode(str(fd, "code"));
  const name = str(fd, "name").replace(/\s+/g, " ");
  const pin = str(fd, "pin");
  const admin = createAdminClient();
  const ipHash = await clientIpHash();

  const since = new Date(Date.now() - 60_000).toISOString();
  const { count: ipCount } = await admin
    .from("student_login_attempts")
    .select("id", { count: "exact", head: true })
    .eq("ip_hash", ipHash)
    .gte("created_at", since);
  if (isIpLimited(ipCount ?? 0)) return { ok: false, error: "시도가 너무 많아요. 1분 뒤에 다시 해 보세요." };

  const record = (studentId: string | null, kind: Attempt["kind"]) =>
    admin.from("student_login_attempts").insert({ student_id: studentId, class_code: code.slice(0, 6), ip_hash: ipHash, kind });

  if (!isValidClassCode(code) || !name) {
    await record(null, "fail");
    return { ok: false, error: STUDENT_FAIL };
  }
  const { data: cls } = await admin.from("classes").select("id").eq("code", code).maybeSingle();
  const { data: student } = cls
    ? await admin.from("profiles").select("id").eq("class_id", cls.id).eq("name", name).eq("role", "student").maybeSingle()
    : { data: null };
  if (!student) {
    await record(null, "fail");
    return { ok: false, error: STUDENT_FAIL };
  }

  const lockState = await studentLockState(student.id);
  if (lockState.locked) return { ok: false, error: lockedMessage() };

  let signedIn = false;
  if (isValidPin(pin)) {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: studentAuthEmail(student.id),
      password: pinToPassword(student.id, pin, pinPepper()),
    });
    signedIn = !error;
  }
  if (!signedIn) {
    await record(student.id, "fail");
    const after = await studentLockState(student.id);
    return { ok: false, error: after.locked ? lockedMessage() : STUDENT_FAIL };
  }
  await record(student.id, "success");
  redirect("/home");
}

function lockedMessage() {
  return `비밀번호를 5번 틀려서 ${LOCK_MINUTES}분 동안 로그인할 수 없어요. 잠시 뒤에 다시 하거나 선생님께 말씀하세요.`;
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
