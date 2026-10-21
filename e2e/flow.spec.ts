// 대표 흐름 1~8 E2E. 로컬 Supabase와 .env.local이 준비된 상태에서 실행한다: npm run test:e2e
import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const run = Date.now().toString(36);
const teacherEmail = `teacher-${run}@test.local`;
const password = "test-password-1234";

async function noPageHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
}

async function studentLogin(page: Page, code: string, name: string, pin: string) {
  await page.goto(`/student-login?code=${code}`);
  await page.getByLabel("이름").fill(name);
  await page.getByLabel("비밀번호").fill(pin);
  await page.getByRole("button", { name: "들어가기" }).click();
  // 로그인 쿠키가 생기고 첫 화면으로 넘어갈 때까지 기다린다
  await page.waitForURL((url) => !url.pathname.startsWith("/student-login"), { timeout: 60_000 });
}

test("대표 흐름: 학급 → 주제 → 방 → 모둠 → 할 일 → 학생 → 공지 → 활동 모아보기", async ({ browser }) => {
  const teacher = await (await browser.newContext()).newPage();

  // 1. 교사 로그인(계정은 메일 발송 없이 관리자 API로 만든다), 학급, 학생 등록
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const { error: createErr } = await admin.auth.admin.createUser({ email: teacherEmail, password, email_confirm: true, user_metadata: { name: "김선생" } });
  expect(createErr).toBeNull();
  await teacher.goto("/login");
  await teacher.getByLabel("이메일").fill(teacherEmail);
  await teacher.getByLabel("비밀번호").fill(password);
  await teacher.getByRole("button", { name: "로그인" }).click();
  await expect(teacher).toHaveURL(/\/teacher$/);
  await teacher.getByLabel("학급 이름").fill("5학년 2반");
  await teacher.getByRole("button", { name: "만들기" }).click();
  await teacher.getByRole("link", { name: /5학년 2반/ }).click();
  const code = (await teacher.locator("p.font-mono").first().textContent())!.trim();
  expect(code).toMatch(/^\d{6}$/);
  const names = ["민준", "서연", "지호", "유나", "하준", "도윤", "예린", "시우", "다은", "지안"];
  await teacher.getByLabel(/이름 목록 붙여넣기/).fill(names.join("\n"));
  await teacher.getByRole("button", { name: "여러 명 등록" }).click();
  const table = teacher.locator("table").first();
  await expect(table).toContainText("민준", { timeout: 60_000 });
  const pins: Record<string, string> = {};
  for (const row of await table.locator("tbody tr").all()) {
    const cells = await row.locator("td").allTextContents();
    pins[cells[1]] = cells[2];
  }
  expect(Object.keys(pins)).toHaveLength(10);
  // 처음 비밀번호는 모두 1234
  expect(new Set(Object.values(pins))).toEqual(new Set(["1234"]));

  // 2. 주제 등록 + 팀장 3명
  await teacher.reload();
  await teacher.getByRole("link", { name: "주제 등록" }).click();
  await teacher.getByLabel("주제 제목").fill("우리 동네 환경 지도 만들기");
  await teacher.getByLabel("전체 목표").fill("동네 환경 문제를 조사해 지도로 만든다");
  const today = new Date();
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const start = iso(new Date(today.getTime() - 3 * 86400000));
  const end = iso(new Date(today.getTime() + 15 * 86400000));
  await teacher.getByLabel("시작일").fill(start);
  await teacher.getByLabel("종료일").fill(end);
  for (const n of ["민준", "서연", "지호"]) await teacher.getByLabel(n, { exact: true }).check();
  await teacher.getByRole("button", { name: "주제 등록" }).click();
  await expect(teacher).toHaveURL(/\/teacher\/topics\//);
  const topicUrl = teacher.url();

  // 3. 팀장 민준이 방을 만든다
  const minjun = await (await browser.newContext()).newPage();
  await studentLogin(minjun, code, "민준", pins["민준"]);
  await expect(minjun.getByRole("heading", { name: "아직 프로젝트 방이 없어요" })).toBeVisible();
  await minjun.getByRole("link", { name: "방 만들기" }).first().click();
  await minjun.getByLabel("방 이름").fill("하천 쓰레기 조사팀");
  await minjun.getByRole("button", { name: "방 만들기" }).click();
  await expect(minjun).toHaveURL(/\/p\//);
  const riverUrl = minjun.url();

  // 교사가 지호를 팀장으로 "공원 식물 지도팀"을 만든다
  await teacher.goto(topicUrl);
  await teacher.getByLabel("방 이름").fill("공원 식물 지도팀");
  // 방 팀장은 여러 명 고를 수 있다(체크박스)
  await teacher.getByRole("group", { name: /방 팀장/ }).getByLabel("지호", { exact: true }).check();
  await teacher.getByRole("button", { name: "방 만들기" }).click();
  await expect(teacher.getByRole("link", { name: "공원 식물 지도팀" })).toBeVisible();

  // 4. 학생 추가와 모둠
  await teacher.goto(riverUrl.replace(/\/p\/([^/]+).*/, "/p/$1/members"));
  for (const n of ["서연", "유나", "하준"]) await teacher.locator("fieldset").filter({ hasText: "고른 학생 추가" }).getByLabel(n, { exact: true }).check();
  await teacher.getByRole("button", { name: "고른 학생 추가" }).click();
  await expect(teacher.getByText("3명을 추가했어요")).toBeVisible();

  await teacher.goto(topicUrl);
  await teacher.getByRole("link", { name: "공원 식물 지도팀" }).first().click();
  await expect(teacher).toHaveURL(/\/p\/[0-9a-f-]+$/);
  const parkUrl = teacher.url();
  await teacher.goto(`${parkUrl}/members`);
  await expect(teacher.getByText("(하천 쓰레기 조사팀 소속)").first()).toBeVisible();
  for (const n of ["도윤", "예린", "시우", "다은", "지안"]) await teacher.locator("fieldset").filter({ hasText: "고른 학생 추가" }).getByLabel(n, { exact: true }).check();
  await teacher.getByRole("button", { name: "고른 학생 추가" }).click();
  await teacher.getByLabel("새 모둠 이름").fill("1모둠");
  await teacher.getByRole("button", { name: "모둠 만들기" }).click();
  await teacher.getByLabel("새 모둠 이름").fill("2모둠");
  await teacher.getByRole("button", { name: "모둠 만들기" }).click();
  await teacher.reload();
  const moves: [string, string][] = [["도윤", "1모둠"], ["예린", "1모둠"], ["시우", "2모둠"], ["다은", "2모둠"]];
  for (const [i, [n, g]] of moves.entries()) {
    await teacher.getByLabel(`${n} 모둠`).selectOption({ label: g });
    await teacher.getByLabel(`${n} 모둠`).locator("xpath=..").getByRole("button", { name: "모둠 바꾸기" }).click();
    // 폼마다 결과 문구가 남으므로 i+1개가 될 때까지 기다린다
    await expect(teacher.getByText("모둠을 바꿨어요")).toHaveCount(i + 1);
  }
  await teacher.reload();
  await teacher.getByLabel("1모둠 모둠장").selectOption({ label: "도윤" });
  await teacher.getByLabel("1모둠 모둠장").locator("xpath=..").getByRole("button", { name: "모둠장 정하기" }).click();
  await expect(teacher.getByText("모둠장을 정했어요")).toBeVisible();

  // 5. 민준이 할 일을 만들고 배정
  await minjun.goto(`${riverUrl}/tasks`);
  await minjun.getByLabel("제목").fill("하천 사진 찍기");
  await minjun.getByLabel("마감일 (선택)").fill(iso(new Date(today.getTime() + 2 * 86400000)));
  // 담당자 여러 명
  await minjun.getByTestId("assignee-options").getByLabel("서연", { exact: true }).check();
  await minjun.getByTestId("assignee-options").getByLabel("유나", { exact: true }).check();
  await minjun.getByRole("button", { name: "추가" }).click();
  await expect(minjun.getByText("할 일을 추가했어요")).toBeVisible();

  // 1모둠장 도윤이 자기 모둠 할 일을 만든다
  const doyun = await (await browser.newContext()).newPage();
  await studentLogin(doyun, code, "도윤", pins["도윤"]);
  await doyun.goto(`${parkUrl}/tasks`);
  await doyun.getByLabel("제목").fill("1모둠 식물 조사");
  await doyun.getByTestId("assignee-options").getByLabel("예린", { exact: true }).check();
  await doyun.getByRole("button", { name: "추가" }).click();
  await expect(doyun.getByText("할 일을 추가했어요")).toBeVisible();

  // 6. 학생 서연: 대시보드 → 내 할 일 → 상태 변경 → 사진 업로드
  const seoyeon = await (await browser.newContext()).newPage();
  await studentLogin(seoyeon, code, "서연", pins["서연"]);
  await expect(seoyeon).toHaveURL(/\/p\//);
  await expect(seoyeon.getByText("흐름도")).toBeVisible();
  await seoyeon.getByRole("link", { name: "내 할 일" }).click();
  await seoyeon.getByRole("link", { name: "하천 사진 찍기" }).click();
  await seoyeon.getByRole("radio", { name: "작업 중" }).click();
  await expect(seoyeon.getByRole("radio", { name: "작업 중" })).toHaveAttribute("aria-checked", "true");
  await seoyeon.reload();
  await expect(seoyeon.getByRole("radio", { name: "작업 중" })).toHaveAttribute("aria-checked", "true");
  await seoyeon.setInputFiles('input[type="file"]', {
    name: "photo.png",
    mimeType: "image/png",
    buffer: Buffer.from("89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8ffff3f0005fe02fea7d6a5b10000000049454e44ae426082", "hex"),
  });
  await seoyeon.getByRole("button", { name: "올리기", exact: true }).click();
  await expect(seoyeon.getByText("파일을 올렸어요")).toBeVisible();
  await seoyeon.getByLabel("글로 남기기").fill("하천에서 쓰레기 12개를 주웠다\n플라스틱이 가장 많았다");
  await seoyeon.getByRole("button", { name: "글 올리기" }).click();
  await expect(seoyeon.getByText("글을 올렸어요")).toBeVisible();
  await expect(seoyeon.getByTestId("attachment-list").getByText("플라스틱이 가장 많았다")).toBeVisible();

  // 2모둠 시우는 1모둠 할 일을 볼 수 없다
  const siwoo = await (await browser.newContext()).newPage();
  await studentLogin(siwoo, code, "시우", pins["시우"]);
  await siwoo.goto(`${parkUrl}/tasks`);
  await expect(siwoo.getByText("1모둠 식물 조사")).toHaveCount(0);

  // 7. 공지와 댓글
  await minjun.goto(`${riverUrl}/notices`);
  await minjun.getByLabel("제목").fill("내일 사진 모으기");
  await minjun.getByLabel("내용").fill("각자 찍은 사진을 올려 주세요");
  await minjun.getByRole("button", { name: "올리기", exact: true }).click();
  await seoyeon.goto(`${riverUrl}/notices`);
  await seoyeon.getByLabel("댓글").fill("네 알겠어요");
  await seoyeon.getByRole("button", { name: "등록" }).click();
  await expect(seoyeon.getByText("네 알겠어요")).toBeVisible();

  // 8. 교사: 학생별 활동 모아보기
  await teacher.goto(`${topicUrl}/activity`);
  await expect(teacher.getByTestId("activity-row")).toHaveCount(10);
  await expect(teacher.getByTestId("no-room-students")).toHaveCount(0);

  // 대시보드 스크린샷 3개 뷰포트 + 페이지 가로 스크롤 없음(AC24)
  for (const [w, h] of [[375, 812], [768, 1024], [1280, 800]]) {
    await seoyeon.setViewportSize({ width: w, height: h });
    await seoyeon.goto(riverUrl);
    await noPageHorizontalScroll(seoyeon);
    await seoyeon.screenshot({ path: `e2e/screenshots/dashboard-${w}.png`, fullPage: true });
  }
});
