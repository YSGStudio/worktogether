import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { generateTaskDrafts, type ModelRequest } from "./aiTasks";
import type { AiPromptInput } from "./domain/ai";

const range = { start: "2026-11-02", end: "2026-11-20" };
const input: AiPromptInput = {
  topicTitle: "우리 동네 환경 지도 만들기",
  topicGoal: "동네 환경 문제를 조사해 지도로 만든다",
  roomName: "하천 쓰레기 조사팀",
  roomDescription: "하천 주변 쓰레기를 조사",
  groupName: "1모둠",
  startDate: range.start,
  endDate: range.end,
  memberCount: 4,
  extraInstruction: "발표 준비 포함",
};
const draft = (i: number) => ({ title: `할 일 ${i}`, description: "", start_date: "2026-11-03", due_date: "2026-11-06" });

describe("AI 할 일 생성 (OpenAI 모킹)", () => {
  it("정상 응답이면 초안을 돌려준다", async () => {
    const call = vi.fn(async () => JSON.stringify({ tasks: [draft(1), draft(2), draft(3), draft(4)] }));
    const r = await generateTaskDrafts(input, range, call, "gpt-5.4-mini");
    expect(r.ok && r.drafts).toHaveLength(4);
    expect(call).toHaveBeenCalledWith(expect.objectContaining({ model: "gpt-5.4-mini" }));
  });

  it("요청 본문에 학생 이름이 없고 인원 수만 들어간다", async () => {
    let sent: ModelRequest | null = null;
    const call = vi.fn(async (req: ModelRequest) => {
      sent = req;
      return JSON.stringify({ tasks: [draft(1), draft(2), draft(3)] });
    });
    await generateTaskDrafts(input, range, call);
    const body = JSON.stringify(sent);
    for (const name of ["김민준", "이서연", "박지호"]) expect(body).not.toContain(name);
    expect(body).toContain("인원: 4명");
  });

  it("잘못된 JSON이면 오류(저장할 초안 없음)", async () => {
    const r = await generateTaskDrafts(input, range, async () => "{ tasks: [ 깨진");
    expect(r.ok).toBe(false);
  });

  it("개수 초과면 오류", async () => {
    const r = await generateTaskDrafts(input, range, async () => JSON.stringify({ tasks: Array.from({ length: 12 }, (_, i) => draft(i)) }));
    expect(r.ok).toBe(false);
  });

  it("API 실패면 오류", async () => {
    const r = await generateTaskDrafts(input, range, async () => {
      throw new Error("500");
    });
    expect(r).toMatchObject({ ok: false });
  });
});
