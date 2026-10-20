// 권한(RLS) 테스트: 로컬 Supabase(`supabase start` + `supabase db reset`)에서 실행한다.
//   SUPABASE_URL=http://127.0.0.1:54321 SUPABASE_ANON_KEY=... SUPABASE_SERVICE_ROLE_KEY=... npm run test:rls
// 역할: 교사, 다른 교사, 전체 방 팀장, 전체 방 구성원, 모둠 방 팀장, 1모둠장, 1모둠원, 2모둠원,
//       모둠 방 미배치 학생, 다른 방 학생(전체 방 구성원이 모둠 방 기준으로 다른 방), 다른 학급 학생
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const URL_ = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const ANON = process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
if (!ANON || !SERVICE) {
  console.error("SUPABASE_ANON_KEY와 SUPABASE_SERVICE_ROLE_KEY가 필요해요 (supabase status로 확인)");
  process.exit(2);
}

const admin = createClient(URL_, SERVICE, { auth: { persistSession: false } });
const run = Date.now().toString(36);
const PASSWORD = "test-password-1234";
let failures = 0;
let passes = 0;

function check(label: string, ok: boolean, detail?: unknown) {
  if (ok) {
    passes++;
    console.log(`  ✓ ${label}`);
  } else {
    failures++;
    console.log(`  ✗ ${label}`, detail ?? "");
  }
}

async function teacher(name: string) {
  const email = `${name}-${run}@test.local`;
  const { data, error } = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true, user_metadata: { name } });
  if (error) throw error;
  return { id: data.user.id, email };
}

async function student(classId: string, name: string) {
  const id = crypto.randomUUID();
  const email = `${id}@student.local`;
  const { error } = await admin.auth.admin.createUser({
    id,
    email,
    password: PASSWORD,
    email_confirm: true,
    app_metadata: { role: "student", class_id: classId, name },
  });
  if (error) throw error;
  const { error: pErr } = await admin.from("profiles").upsert({ id, role: "student", name, class_id: classId }, { onConflict: "id" });
  if (pErr) throw pErr;
  return { id, email };
}

async function login(email: string): Promise<SupabaseClient> {
  const c = createClient(URL_, ANON, { auth: { persistSession: false } });
  const { error } = await c.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw new Error(`${email}: ${error.message}`);
  return c;
}

async function ids(c: SupabaseClient, table: string, filter: Record<string, string>) {
  let q = c.from(table).select("id");
  for (const [k, v] of Object.entries(filter)) q = q.eq(k, v);
  const { data } = await q;
  return new Set((data ?? []).map((r: { id: string }) => r.id));
}

async function main() {
  console.log("준비: 계정과 데이터 만들기");
  const tA = await teacher("teacherA");
  const tB = await teacher("teacherB");
  const cA = await login(tA.email);
  const cB = await login(tB.email);

  const { data: clsA, error: clsErr } = await cA.from("classes").insert({ teacher_id: tA.id, name: "5-2", code: run.slice(-6).toUpperCase().replace(/[01IO]/g, "Z").padEnd(6, "Z") }).select().single();
  if (clsErr) throw clsErr;
  const { data: clsB } = await cB.from("classes").insert({ teacher_id: tB.id, name: "6-1", code: "B" + run.slice(-5).toUpperCase().replace(/[01IO]/g, "Y").padEnd(5, "Y") }).select().single();

  const S = {
    wl: await student(clsA.id, "전체방팀장"),
    wm: await student(clsA.id, "전체방구성원"),
    gl: await student(clsA.id, "모둠방팀장"),
    g1l: await student(clsA.id, "일모둠장"),
    g1m: await student(clsA.id, "일모둠원"),
    g2m: await student(clsA.id, "이모둠원"),
    un: await student(clsA.id, "미배치"),
    plain: await student(clsA.id, "방없는학생"),
    cl: await student(clsA.id, "공동팀장"),
    xb: await student(clsB!.id, "다른학급"),
  };
  const C: Record<keyof typeof S, SupabaseClient> = Object.fromEntries(
    await Promise.all(Object.entries(S).map(async ([k, v]) => [k, await login(v.email)])),
  ) as Record<keyof typeof S, SupabaseClient>;

  const { data: topic } = await cA
    .from("topics")
    .insert({ class_id: clsA.id, teacher_id: tA.id, title: "환경 지도", goal: "지도 만들기", start_date: "2026-11-02", end_date: "2026-11-20" })
    .select()
    .single();
  await cA.from("topic_leaders").insert([
    { topic_id: topic.id, student_id: S.wl.id },
    { topic_id: topic.id, student_id: S.gl.id },
    { topic_id: topic.id, student_id: S.cl.id },
  ]);

  console.log("\nAC7 방 만들기");
  const notLeader = await C.wm.from("projects").insert({ topic_id: topic.id, name: "몰래 방", start_date: "2026-11-02", end_date: "2026-11-20", created_by: S.wm.id });
  check("팀장이 아닌 학생의 방 만들기 거부", !!notLeader.error);
  const wholeId = crypto.randomUUID();
  const { error: wErr } = await C.wl
    .from("projects")
    .insert({ id: wholeId, topic_id: topic.id, name: "하천팀", start_date: "2026-11-02", end_date: "2026-11-20", created_by: S.wl.id });
  check("팀장이 방을 만든다", !wErr, wErr);
  const whole = { id: wholeId };
  const wl = await C.wl.from("project_leaders").select("student_id").eq("project_id", wholeId);
  check("방을 만든 팀장이 그 방 팀장이 된다", (wl.data ?? []).some((r) => r.student_id === S.wl.id));
  const mem = await C.wl.from("project_members").select("student_id").eq("project_id", whole?.id);
  check("팀장은 자동으로 구성원", (mem.data ?? []).some((m) => m.student_id === S.wl.id));
  const second = await C.wl.from("projects").insert({ topic_id: topic.id, name: "두번째", start_date: "2026-11-02", end_date: "2026-11-20", created_by: S.wl.id });
  check("같은 주제 두 번째 방 거부", !!second.error);
  const outside = await cA.from("projects").insert({ topic_id: topic.id, name: "기간밖", start_date: "2026-11-01", end_date: "2026-11-20", created_by: tA.id }).select();
  check("주제 기간 밖 방 거부", !!outside.error);
  const { data: grouped, error: gErr } = await cA
    .from("projects")
    .insert({ topic_id: topic.id, name: "공원팀", start_date: "2026-11-02", end_date: "2026-11-20", created_by: tA.id })
    .select()
    .single();
  if (gErr) throw gErr;
  const { error: glErr } = await cA.from("project_leaders").insert({ project_id: grouped.id, topic_id: topic.id, student_id: S.gl.id });
  if (glErr) throw glErr;

  console.log("\n공동 팀장");
  const byStudentLeader = await C.gl.from("project_leaders").insert({ project_id: grouped.id, topic_id: topic.id, student_id: S.cl.id }).select();
  check("팀장은 공동 팀장을 정할 수 없다", !!byStudentLeader.error || (byStudentLeader.data ?? []).length === 0);
  const coLead = await cA.from("project_leaders").insert({ project_id: grouped.id, topic_id: topic.id, student_id: S.cl.id }).select();
  check("교사는 공동 팀장을 추가한다", !coLead.error, coLead.error);
  const notTopicLeader = await cA.from("project_leaders").insert({ project_id: grouped.id, topic_id: topic.id, student_id: S.plain.id }).select();
  check("주제 팀장이 아닌 학생은 방 팀장이 될 수 없다", !!notTopicLeader.error);
  const otherRoomLeader = await cA.from("project_leaders").insert({ project_id: grouped.id, topic_id: topic.id, student_id: S.wl.id }).select();
  check("다른 방 팀장은 공동 팀장이 될 수 없다", !!otherRoomLeader.error);
  const rooms0 = await C.plain.rpc("topic_rooms", { p_topic: topic.id });
  const park = (rooms0.data ?? []).find((r: { id: string }) => r.id === grouped.id);
  check("방 목록에 공동 팀장 이름이 모두 나온다", park?.leader_names === "공동팀장, 모둠방팀장", park);

  console.log("\nAC8 구성원·모둠 편성은 교사만");
  const byLeader = await C.wl.from("project_members").insert({ project_id: whole.id, topic_id: topic.id, student_id: S.plain.id }).select();
  check("팀장의 학생 추가 거부", !!byLeader.error || (byLeader.data ?? []).length === 0);
  await cA.from("project_members").insert([{ project_id: whole.id, topic_id: topic.id, student_id: S.wm.id }]);
  await cA.from("project_members").insert(
    [S.g1l, S.g1m, S.g2m, S.un].map((s) => ({ project_id: grouped.id, topic_id: topic.id, student_id: s.id })),
  );
  const dup = await cA.from("project_members").insert({ project_id: grouped.id, topic_id: topic.id, student_id: S.wm.id }).select();
  check("한 주제에서 두 방 소속 거부", !!dup.error);
  const crossClass = await cA.from("project_members").insert({ project_id: grouped.id, topic_id: topic.id, student_id: S.xb.id }).select();
  check("다른 학급 학생 추가 거부", !!crossClass.error);

  // 전체 방에 할 일 2개·공지 1개를 만든 뒤 모둠을 만든다(AC9 모델: 공통 항목 유지)
  await cA.from("tasks").insert([
    { project_id: grouped.id, title: "공통 1", created_by: tA.id },
    { project_id: grouped.id, title: "공통 2", created_by: tA.id },
  ]);
  await cA.from("notices").insert({ project_id: grouped.id, author_id: tA.id, title: "공통 공지", body: "모두 보세요" });

  const byStudentGroup = await C.gl.from("groups").insert({ project_id: grouped.id, name: "몰래모둠" }).select();
  check("팀장의 모둠 만들기 거부", !!byStudentGroup.error || (byStudentGroup.data ?? []).length === 0);
  const { data: g1 } = await cA.from("groups").insert({ project_id: grouped.id, name: "1모둠" }).select().single();
  const { data: g2 } = await cA.from("groups").insert({ project_id: grouped.id, name: "2모둠" }).select().single();
  await cA.from("group_members").insert([
    { group_id: g1.id, project_id: grouped.id, student_id: S.g1l.id },
    { group_id: g1.id, project_id: grouped.id, student_id: S.g1m.id },
    { group_id: g2.id, project_id: grouped.id, student_id: S.g2m.id },
  ]);
  await cA.from("groups").update({ leader_id: S.g1l.id }).eq("id", g1.id);
  const { count: commonCount } = await admin.from("tasks").select("id", { count: "exact", head: true }).eq("project_id", grouped.id).is("group_id", null);
  check("AC9 첫 모둠 생성 후 기존 할 일은 방 공통으로 유지(2개)", commonCount === 2);

  console.log("\nAC11 할 일 작성 권한");
  const wTask = await C.wl.from("tasks").insert({ project_id: whole.id, title: "조사 계획", created_by: S.wl.id }).select().single();
  check("전체 방 팀장 할 일 작성", !wTask.error, wTask.error);
  const wmTask = await C.wm.from("tasks").insert({ project_id: whole.id, title: "몰래", created_by: S.wm.id }).select();
  check("전체 방 구성원 할 일 작성 거부", !!wmTask.error);
  const g1Task = await C.g1l.from("tasks").insert({ project_id: grouped.id, group_id: g1.id, title: "1모둠 할 일", due_date: "2026-11-03", created_by: S.g1l.id }).select().single();
  check("1모둠장 자기 모둠 할 일 작성", !g1Task.error, g1Task.error);
  const g1Assign = await C.g1l.from("task_assignees").insert({ task_id: g1Task.data!.id, student_id: S.g1m.id });
  check("1모둠장이 자기 모둠 할 일 담당자를 정한다", !g1Assign.error, g1Assign.error);
  const g1to2 = await C.g1l.from("tasks").insert({ project_id: grouped.id, group_id: g2.id, title: "남의 모둠", created_by: S.g1l.id }).select();
  check("1모둠장 2모둠 할 일 작성 거부", !!g1to2.error);
  const g1common = await C.g1l.from("tasks").insert({ project_id: grouped.id, title: "공통", created_by: S.g1l.id }).select();
  check("1모둠장 방 공통 할 일 작성 거부", !!g1common.error);
  const { data: g2Task } = await C.gl.from("tasks").insert({ project_id: grouped.id, group_id: g2.id, title: "2모둠 할 일", created_by: S.gl.id }).select().single();
  check("모둠 방 팀장은 2모둠 할 일 작성", !!g2Task);
  await C.gl.from("task_assignees").insert({ task_id: g2Task!.id, student_id: S.g2m.id });
  const badAssignee = await C.gl.from("task_assignees").insert({ task_id: g2Task!.id, student_id: S.g1m.id });
  check("AC14 모둠 할 일 담당자는 그 모둠원만", !!badAssignee.error);
  const memberAssign = await C.g1m.from("task_assignees").insert({ task_id: g1Task.data!.id, student_id: S.g1m.id });
  check("일반 학생은 담당자를 정할 수 없다", !!memberAssign.error);

  console.log("\n담당자 여러 명");
  const { data: commonTasks } = await cA.from("tasks").select("id, title").eq("project_id", grouped.id).is("group_id", null).order("title");
  const common1 = commonTasks![0].id;
  const common2 = commonTasks![1].id;
  const multi = await cA.from("task_assignees").insert([
    { task_id: common1, student_id: S.un.id },
    { task_id: common1, student_id: S.g2m.id },
  ]);
  check("한 할 일에 담당자 두 명", !multi.error, multi.error);
  const twoTasks = await cA.from("task_assignees").insert({ task_id: common2, student_id: S.un.id });
  check("한 학생이 할 일 두 개를 맡는다", !twoTasks.error, twoTasks.error);
  const coA = await C.un.from("tasks").update({ status: "doing" }).eq("id", common1).select();
  check("공동 담당자(미배치 학생)도 상태를 바꾼다", (coA.data ?? []).length === 1, coA.error);
  const coB = await C.g2m.from("tasks").update({ status: "done" }).eq("id", common1).select();
  check("다른 공동 담당자도 상태를 바꾼다", (coB.data ?? []).length === 1, coB.error);
  const notCo = await C.g1m.from("tasks").update({ status: "todo" }).eq("id", common1).select();
  check("담당이 아닌 학생은 상태를 못 바꾼다", (notCo.data ?? []).length === 0);
  const assigneesSeen = await C.g1m.from("task_assignees").select("student_id").eq("task_id", common1);
  check("같은 방 학생은 방 공통 할 일 담당자 목록을 본다", (assigneesSeen.data ?? []).length === 2);
  const assigneesHidden = await C.g2m.from("task_assignees").select("student_id").eq("task_id", g1Task.data!.id);
  check("다른 모둠 할 일 담당자 목록은 못 본다", (assigneesHidden.data ?? []).length === 0);
  await cA.from("tasks").update({ status: "todo" }).in("id", [common1, common2]);

  console.log("\nAC10 공개 범위");
  const visible = async (c: SupabaseClient) => ids(c, "tasks", { project_id: grouped.id });
  const v1 = await visible(C.g1m);
  check("1모둠원은 1모둠 할 일을 본다", v1.has(g1Task.data!.id));
  check("1모둠원은 2모둠 할 일을 못 본다", !v1.has(g2Task!.id));
  check("1모둠원은 방 공통 할 일을 본다", v1.size === 3);
  const vUn = await visible(C.un);
  check("미배치 학생은 방 공통만(2개)", vUn.size === 2);
  const vLeader = await visible(C.gl);
  check("모둠 방 팀장은 전부 본다", vLeader.size === 4);
  check("공동 팀장도 전부 본다", (await visible(C.cl)).size === 4);
  const vOther = await visible(C.wm);
  check("다른 방 학생은 아무것도 못 본다", vOther.size === 0);
  const vX = await visible(C.xb);
  check("다른 학급 학생은 아무것도 못 본다", vX.size === 0);
  const vTB = await visible(cB);
  check("AC5 다른 교사는 할 일을 못 본다", vTB.size === 0);
  const vTA = await visible(cA);
  check("교사는 전부 본다", vTA.size === 4);
  const wholeVis = await ids(C.wm, "tasks", { project_id: whole.id });
  check("전체 방 구성원은 방의 모든 할 일을 본다", wholeVis.has(wTask.data!.id));
  const direct = await C.g1m.from("tasks").select("id").eq("id", g2Task!.id).maybeSingle();
  check("2모둠 할 일 ID 직접 조회 거부", !direct.data);

  console.log("\nAC5 교사 간 분리");
  check("다른 교사는 학급을 못 본다", (await ids(cB, "classes", { id: clsA.id })).size === 0);
  check("다른 교사는 주제를 못 본다", (await ids(cB, "topics", { id: topic.id })).size === 0);
  check("다른 교사는 방을 못 본다", (await ids(cB, "projects", { id: whole.id })).size === 0);
  const studentCode = await C.wm.from("classes").select("code");
  check("학생은 학급코드를 못 본다", (studentCode.data ?? []).length === 0);
  const attempts = await C.wm.from("student_login_attempts").select("id");
  check("학생은 로그인 기록을 못 본다", (attempts.data ?? []).length === 0);

  console.log("\nAC16 상태 변경");
  const byAssignee = await C.g1m.from("tasks").update({ status: "doing" }).eq("id", g1Task.data!.id).select();
  check("담당자 상태 변경", (byAssignee.data ?? []).length === 1, byAssignee.error);
  const assigneeTitle = await C.g1m.from("tasks").update({ title: "바꿈" }).eq("id", g1Task.data!.id).select();
  check("담당자는 제목을 못 바꾼다", !!assigneeTitle.error);
  // 1모둠원은 방 공통 할 일의 담당자가 아니다
  const byOther = await C.g1m.from("tasks").update({ status: "done" }).is("group_id", null).eq("project_id", grouped.id).select();
  check("일반 학생 상태 변경 거부", (byOther.data ?? []).length === 0);
  const g1lOn2 = await C.g1l.from("tasks").update({ status: "done" }).eq("id", g2Task!.id).select();
  check("1모둠장은 2모둠 할 일 상태를 못 바꾼다", (g1lOn2.data ?? []).length === 0);

  console.log("\nAC14 모둠 이동 시 담당 해제");
  await cA.from("group_members").update({ group_id: g2.id }).eq("project_id", grouped.id).eq("student_id", S.g1m.id);
  const { data: afterMove } = await admin.from("task_assignees").select("student_id").eq("task_id", g1Task.data!.id);
  check("이전 모둠 할 일 담당에서 빠진다", (afterMove ?? []).length === 0, afterMove);
  const { data: commonKept } = await admin.from("task_assignees").select("student_id").eq("task_id", common1);
  check("방 공통 할 일 담당은 모둠을 옮겨도 그대로", (commonKept ?? []).length === 2);
  await cA.from("group_members").update({ group_id: g1.id }).eq("project_id", grouped.id).eq("student_id", S.g1m.id);
  await cA.from("task_assignees").insert({ task_id: g1Task.data!.id, student_id: S.g1m.id });

  console.log("\nAC18 공지·댓글");
  const { data: g1Notice, error: nErr } = await C.g1l.from("notices").insert({ project_id: grouped.id, group_id: g1.id, author_id: S.g1l.id, title: "1모둠 공지", body: "내일 모여요" }).select().single();
  check("모둠장 자기 모둠 공지", !nErr, nErr);
  const memberNotice = await C.g1m.from("notices").insert({ project_id: grouped.id, group_id: g1.id, author_id: S.g1m.id, title: "x", body: "x" }).select();
  check("일반 학생 공지 작성 거부", !!memberNotice.error);
  check("2모둠원은 1모둠 공지를 못 본다", (await ids(C.g2m, "notices", { project_id: grouped.id })).size === 1);
  check("미배치 학생은 방 공통 공지를 본다", (await ids(C.un, "notices", { project_id: grouped.id })).size === 1);
  const { data: cm, error: cmErr } = await C.g1m.from("notice_comments").insert({ notice_id: g1Notice!.id, author_id: S.g1m.id, body: "네!" }).select().single();
  check("공지를 볼 수 있는 학생은 댓글을 단다", !cmErr, cmErr);
  const c2 = await C.g2m.from("notice_comments").insert({ notice_id: g1Notice!.id, author_id: S.g2m.id, body: "몰래" }).select();
  check("공지를 못 보는 학생은 댓글 거부", !!c2.error);
  check("2모둠원은 1모둠 댓글을 못 본다", ((await C.g2m.from("notice_comments").select("id").eq("id", cm!.id)).data ?? []).length === 0);
  const delOther = await C.g1l.from("notice_comments").delete().eq("id", cm!.id).select();
  check("남의 댓글 삭제 거부(모둠장)", (delOther.data ?? []).length === 0);
  const delLeader = await C.gl.from("notice_comments").select("id").eq("id", cm!.id);
  check("방 팀장은 그 댓글을 본다", (delLeader.data ?? []).length === 1);

  console.log("\n첨부·Storage");
  const att = await C.g1m.from("task_attachments").insert({ task_id: g1Task.data!.id, kind: "link", url: "https://example.com", file_name: "자료", uploaded_by: S.g1m.id }).select().single();
  check("담당자 링크 첨부", !att.error, att.error);
  const badLink = await C.g1m.from("task_attachments").insert({ task_id: g1Task.data!.id, kind: "link", url: "javascript:alert(1)", file_name: "x", uploaded_by: S.g1m.id }).select();
  check("javascript: 링크 거부(DB)", !!badLink.error);
  check("2모둠원은 1모둠 첨부를 못 본다", ((await C.g2m.from("task_attachments").select("id").eq("id", att.data!.id)).data ?? []).length === 0);
  const path = `${topic.id}/${grouped.id}/${g1.id}/${g1Task.data!.id}/${crypto.randomUUID()}.png`;
  const png = new Blob([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], { type: "image/png" });
  const up = await C.g1m.storage.from("task-files").upload(path, png, { contentType: "image/png" });
  check("담당자 Storage 업로드", !up.error, up.error);
  const up2 = await C.g2m.storage.from("task-files").upload(path.replace(".png", "-2.png"), png, { contentType: "image/png" });
  check("다른 모둠원 Storage 업로드 거부", !!up2.error);
  const sign2 = await C.g2m.storage.from("task-files").createSignedUrl(path, 60);
  check("2모둠원 서명 URL 발급 거부", !!sign2.error || !sign2.data?.signedUrl);
  const sign1 = await C.g1m.storage.from("task-files").createSignedUrl(path, 60);
  check("1모둠원 서명 URL 발급", !!sign1.data?.signedUrl, sign1.error);
  const exe = await C.g1m.storage.from("task-files").upload(path.replace(".png", ".exe"), new Blob(["MZ"], { type: "application/x-msdownload" }), { contentType: "application/x-msdownload" });
  check(".exe 업로드 거부(버킷 MIME 제한)", !!exe.error);
  const delByTeacher = await cA.storage.from("task-files").remove([path]);
  check("교사는 학생 파일을 지운다", (delByTeacher.data ?? []).length === 1, delByTeacher.error);

  console.log("\nAC13 AI 일일 제한(작업 공간별)");
  const logs = Array.from({ length: 20 }, () => ({ project_id: grouped.id, group_id: g1.id, requested_by: S.g1l.id }));
  await admin.from("ai_generation_log").insert(logs);
  const used1 = await C.g1l.rpc("ai_usage_today", { p_project: grouped.id, p_group: g1.id });
  check("1모둠 사용량 20 → 21번째 거부 대상", used1.data === 20);
  const used2 = await C.gl.rpc("ai_usage_today", { p_project: grouped.id, p_group: g2.id });
  check("2모둠은 영향 없음", used2.data === 0);
  const aiByMember = await C.g1m.from("ai_generation_log").insert({ project_id: grouped.id, group_id: g1.id, requested_by: S.g1m.id }).select();
  check("일반 학생 AI 사용 기록 거부", !!aiByMember.error);

  console.log("\nAC20 학생별 활동 모아보기");
  const act = await cA.rpc("topic_student_activity", { p_topic: topic.id });
  check("교사는 집계를 본다(공동 팀장 포함 8명)", !act.error && (act.data ?? []).length === 8, act.error ?? act.data?.length);
  const row = (act.data ?? []).find((r: { student_id: string }) => r.student_id === S.g1m.id);
  check("1모둠원 할 일 수 = 1, 자료 = 1, 댓글 = 1", row?.task_count === 1 && row?.attachment_count === 1 && row?.comment_count === 1, row);
  const unRow = (act.data ?? []).find((r: { student_id: string }) => r.student_id === S.un.id);
  check("미배치 학생 모둠 칸이 비어 있고 모둠 방 표시", unRow?.group_id === null && unRow?.is_group_room === true);
  const actStudent = await C.gl.rpc("topic_student_activity", { p_topic: topic.id });
  check("학생의 집계 접근 거부", !!actStudent.error);
  const actOther = await cB.rpc("topic_student_activity", { p_topic: topic.id });
  check("다른 교사의 집계 접근 거부", !!actOther.error);

  console.log("\n주제 화면 방 목록");
  const rooms = await C.wm.rpc("topic_rooms", { p_topic: topic.id });
  check("같은 학급 학생은 방 이름·팀장을 본다", (rooms.data ?? []).length === 2);
  const roomsX = await C.xb.rpc("topic_rooms", { p_topic: topic.id });
  check("다른 학급 학생은 방 목록을 못 본다", (roomsX.data ?? []).length === 0);
  check("다른 방 학생은 방 행 자체는 못 본다", (await ids(C.wm, "projects", { id: grouped.id })).size === 0);

  console.log("\nAC9 모든 모둠 삭제 → 방 공통");
  await cA.from("groups").delete().eq("project_id", grouped.id);
  const { count: afterDel } = await admin.from("tasks").select("id", { count: "exact", head: true }).eq("project_id", grouped.id).is("group_id", null);
  check("모둠 삭제 후 모든 할 일이 방 공통(행 수 유지 4)", afterDel === 4);

  // 정리
  await admin.from("topics").delete().in("class_id", [clsA.id, clsB!.id]);
  await admin.from("classes").delete().in("id", [clsA.id, clsB!.id]);
  for (const u of [tA, tB, ...Object.values(S)]) await admin.auth.admin.deleteUser(u.id);
  await admin.storage.from("task-files").remove([path]);

  console.log(`\n결과: ${passes} 통과, ${failures} 실패`);
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
