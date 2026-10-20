import { z } from "zod";
import { daysBetween, isDateString } from "./dates";

export const AI_DAILY_LIMIT = 20;
export const AI_MIN_TASKS = 3;
export const AI_MAX_TASKS = 10;

const dateField = z.string().refine((s) => isDateString(s), "날짜 형식이 아니에요");

export const aiDraftSchema = z.object({
  title: z.string().trim().min(1).max(100),
  description: z.string().trim().max(500).default(""),
  start_date: dateField,
  due_date: dateField,
});

export const aiResponseSchema = z.object({
  tasks: z.array(aiDraftSchema).min(AI_MIN_TASKS).max(AI_MAX_TASKS),
});

export type AiDraft = z.infer<typeof aiDraftSchema>;

// AI에 보내는 정보. 학생 이름 같은 개인정보는 넣지 않는다(인원 수만).
export type AiPromptInput = {
  topicTitle: string;
  topicGoal: string;
  roomName: string;
  roomDescription: string | null;
  groupName: string | null;
  startDate: string;
  endDate: string;
  memberCount: number;
  extraInstruction: string | null;
};

export const AI_SYSTEM_PROMPT = [
  "너는 초등 고학년~중학생 모둠 프로젝트를 돕는 선생님이다.",
  "할 일은 '프로젝트 방 주제'(방 이름과 방 설명)를 중심으로 만든다. 이 방이 실제로 조사·제작·발표할 내용이 할 일의 대부분이어야 한다.",
  "'전체 주제'와 '전체 목표'는 학급 전체가 함께 하는 큰 틀이다. 방의 결과물이 전체 목표에 어떻게 이어지는지 확인하는 데만 참고하고, 다른 방이 맡을 만한 일은 넣지 않는다.",
  "모둠이 주어지면 그 모둠이 방 안에서 맡을 수 있는 일로 좁힌다.",
  "주어진 기간 안에서 학생들이 실제로 할 수 있는 작은 할 일로 나누고, 계획 → 조사·제작 → 정리·발표 순서가 드러나게 날짜를 배치한다.",
  "할 일 제목은 짧고 쉬운 말로, 설명은 무엇을 하면 되는지 한두 문장으로 쓴다.",
  "모든 날짜는 주어진 기간 안의 YYYY-MM-DD 형식이고 due_date는 start_date와 같거나 뒤다.",
  `할 일은 ${AI_MIN_TASKS}개 이상 ${AI_MAX_TASKS}개 이하로 만든다.`,
  '반드시 다음 JSON만 출력한다: {"tasks":[{"title":"...","description":"...","start_date":"YYYY-MM-DD","due_date":"YYYY-MM-DD"}]}',
].join("\n");

export function buildAiUserPrompt(input: AiPromptInput): string {
  const lines = ["[중심] 프로젝트 방 주제", `- 방 이름: ${input.roomName}`];
  if (input.roomDescription) lines.push(`- 방 설명: ${input.roomDescription}`);
  if (input.groupName) lines.push(`- 작업 공간(모둠): ${input.groupName}`);
  lines.push("", "[참고] 학급 전체 주제", `- 전체 주제: ${input.topicTitle}`, `- 전체 목표: ${input.topicGoal}`);
  lines.push(
    "",
    "[조건]",
    `- 기간: ${input.startDate} ~ ${input.endDate} (${daysBetween(input.startDate, input.endDate) + 1}일)`,
    `- 인원: ${input.memberCount}명`,
  );
  if (input.extraInstruction) lines.push(`- 추가 지시: ${input.extraInstruction}`);
  return lines.join("\n");
}

export type ParseResult = { ok: true; drafts: AiDraft[] } | { ok: false; error: string };

// 응답 텍스트에서 JSON을 꺼내 검증한다. 날짜가 방 기간을 벗어나면 기간 안으로 맞춘다.
export function parseAiResponse(text: string, range: { start: string; end: string }): ParseResult {
  const json = extractJson(text);
  if (json === undefined) return { ok: false, error: "AI 응답을 읽을 수 없어요. 다시 시도해 주세요." };
  const parsed = aiResponseSchema.safeParse(json);
  if (!parsed.success) return { ok: false, error: "AI 응답 형식이 맞지 않아요. 다시 시도해 주세요." };
  const drafts = parsed.data.tasks.map((t) => {
    const start = clampDate(t.start_date, range);
    let due = clampDate(t.due_date, range);
    if (due < start) due = start;
    return { ...t, start_date: start, due_date: due };
  });
  return { ok: true, drafts };
}

function clampDate(d: string, range: { start: string; end: string }): string {
  if (d < range.start) return range.start;
  if (d > range.end) return range.end;
  return d;
}

function extractJson(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : trimmed;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start < 0 || end <= start) return undefined;
  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch {
    return undefined;
  }
}

